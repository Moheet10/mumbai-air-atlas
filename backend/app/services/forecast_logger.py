"""
Forecast Logger and Live Out-of-Sample Scorecard Service.
Persists issued CAMS and Station Model forecasts into `forecast_log.csv`
and evaluates mature predictions against incoming physical station readings.
"""

import os
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "mumbai_air.db")
CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "forecast_log.csv")


def init_forecast_log_table(db_path: str = DB_PATH):
    if os.getenv("VERCEL"):
        return
    try:
        conn = sqlite3.connect(db_path, timeout=30.0)
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS forecast_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_time TEXT NOT NULL,
                horizon INTEGER NOT NULL,
                model TEXT NOT NULL,
                value REAL NOT NULL,
                station_id TEXT NOT NULL,
                logged_at TEXT NOT NULL,
                UNIQUE(issue_time, horizon, model, station_id)
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_forecast_log_issue ON forecast_log (issue_time, station_id);")
        conn.commit()
        conn.close()
    except Exception:
        pass


def log_forecast_run(
    issue_time_utc: str,
    station_id: str,
    cams_points: List[Dict[str, Any]],
    atlas_points: Optional[List[Dict[str, Any]]],
    db_path: str = DB_PATH,
    csv_path: str = CSV_PATH,
) -> int:
    """
    Log forecasts for CAMS and Station models into forecast_log.csv and SQLite.
    """
    if os.getenv("VERCEL"):
        return 0
    init_forecast_log_table(db_path)
    now_utc_str = datetime.now(timezone.utc).isoformat()
    records = []

    # CAMS points (lead hours 1..48)
    for i, pt in enumerate(cams_points[:48]):
        h = i + 1
        val = pt.get("value")
        if val is not None:
            records.append({
                "issue_time": issue_time_utc,
                "horizon": h,
                "model": "cams",
                "value": float(val),
                "station_id": str(station_id),
                "logged_at": now_utc_str,
            })

    # Station model points (discrete horizons 1, 6, 12, 24, 48)
    if atlas_points:
        discrete_horizons = [1, 6, 12, 24, 48]
        for i, pt in enumerate(atlas_points):
            h = discrete_horizons[i] if i < len(discrete_horizons) else (i + 1)
            val = pt.get("value")
            if val is not None:
                records.append({
                    "issue_time": issue_time_utc,
                    "horizon": h,
                    "model": "station_model",
                    "value": float(val),
                    "station_id": str(station_id),
                    "logged_at": now_utc_str,
                })

    if not records:
        return 0

    new_df = pd.DataFrame(records)

    # 1. Update CSV
    try:
        if os.path.exists(csv_path):
            existing_df = pd.read_csv(csv_path)
            combined = pd.concat([existing_df, new_df], ignore_index=True)
            combined = combined.drop_duplicates(subset=["issue_time", "horizon", "model", "station_id"], keep="last")
        else:
            combined = new_df
        combined.to_csv(csv_path, index=False)
    except Exception as e:
        print(f"Warning: failed to write to {csv_path}: {e}")

    # 2. Update SQLite if available
    try:
        conn = sqlite3.connect(db_path, timeout=30.0)
        cur = conn.cursor()
        sql_rows = [
            (r["issue_time"], r["horizon"], r["model"], r["value"], r["station_id"], r["logged_at"])
            for r in records
        ]
        cur.executemany(
            """
            INSERT OR REPLACE INTO forecast_log (issue_time, horizon, model, value, station_id, logged_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            sql_rows,
        )
        conn.commit()
        conn.close()
    except Exception:
        pass

    return len(records)


def evaluate_live_scorecard(
    station_id: Optional[str] = None,
    csv_path: str = CSV_PATH,
    db_path: str = DB_PATH,
) -> Dict[str, Any]:
    """
    Score logged forecasts against incoming physical station readings in `station_hourly`.
    Reads from forecast_log.csv.
    """
    if not os.path.exists(csv_path):
        return {
            "status": "collecting",
            "n": 0,
            "date_range": None,
            "horizons": {},
            "message": "Collecting out-of-sample record (n = 0). No forecast runs logged yet.",
        }

    try:
        df_log = pd.read_csv(csv_path)
    except Exception:
        return {
            "status": "collecting",
            "n": 0,
            "date_range": None,
            "horizons": {},
            "message": "Error loading forecast log.",
        }

    if df_log.empty:
        return {
            "status": "collecting",
            "n": 0,
            "date_range": None,
            "horizons": {},
            "message": "Collecting out-of-sample record (n = 0). No forecast runs logged yet.",
        }

    if station_id:
        df_log = df_log[df_log["station_id"] == str(station_id)]

    if df_log.empty:
        return {
            "status": "collecting",
            "n": 0,
            "date_range": None,
            "horizons": {},
            "message": "No forecasts logged yet for this specific station.",
        }

    # If SQLite database with station_hourly is available, join and verify
    if os.path.exists(db_path):
        try:
            from pathlib import Path
            uri = Path(db_path).resolve().as_uri() + "?mode=ro"
            conn = sqlite3.connect(uri, uri=True, timeout=30.0)
            st_df = pd.read_sql_query(
                "SELECT station_id, timestamp_utc, pm2_5 AS actual_val FROM station_hourly WHERE pm2_5 IS NOT NULL",
                conn,
            )
            conn.close()

            if not st_df.empty:
                # Compute target timestamp = issue_time + horizon hours
                df_log["issue_dt"] = pd.to_datetime(df_log["issue_time"], utc=True)
                df_log["target_dt"] = df_log["issue_dt"] + pd.to_timedelta(df_log["horizon"], unit="h")
                df_log["target_ts"] = df_log["target_dt"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

                merged = pd.merge(
                    df_log,
                    st_df,
                    left_on=["station_id", "target_ts"],
                    right_on=["station_id", "timestamp_utc"],
                    how="inner",
                )

                if not merged.empty:
                    horizons_eval = {}
                    for h in [1, 6, 12, 24, 48]:
                        h_df = merged[merged["horizon"] == h]
                        if not h_df.empty:
                            mod_df = h_df[h_df["model"].isin(["station_model", "atlas"])]
                            cams_df = h_df[h_df["model"] == "cams"]
                            if not mod_df.empty:
                                mae_mod = float(np.mean(np.abs(mod_df["value"] - mod_df["actual_val"])))
                                mae_cams = float(np.mean(np.abs(cams_df["value"] - cams_df["actual_val"]))) if not cams_df.empty else None
                                horizons_eval[str(h)] = {
                                    "n": len(mod_df),
                                    "mae_atlas": round(mae_mod, 2),
                                    "mae_cams": round(mae_cams, 2) if mae_cams else None,
                                }

                    if horizons_eval:
                        return {
                            "status": "verified",
                            "n": len(merged),
                            "date_range": f"{merged['timestamp_utc'].min()} to {merged['timestamp_utc'].max()}",
                            "horizons": horizons_eval,
                            "message": f"Evaluated {len(merged)} verified out-of-sample forecast hours against physical ground telemetry.",
                        }
        except Exception:
            pass

    return {
        "status": "collecting",
        "n": len(df_log),
        "date_range": None,
        "horizons": {},
        "message": f"Logged {len(df_log)} predictions. Pending mature station sensor arrival for verification.",
    }

