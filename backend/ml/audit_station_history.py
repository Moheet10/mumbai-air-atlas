"""
Station History Audit, CAMS Comparison, and Station Ingestion Pipeline.
Queries OpenAQ v3 /sensors/{id}/hours for Mumbai monitoring stations,
caches raw JSON to disk, performs QA/QC data cleansing (drops negatives,
>1000, and flatlines >6h), stores clean series into SQLite `station_hourly`,
and computes CAMS vs station comparative statistics.
"""

import os
import sys
import json
import time
import sqlite3
import asyncio
from datetime import datetime, timezone, timedelta
import zoneinfo
import numpy as np
import pandas as pd
import httpx
from dotenv import load_dotenv

load_dotenv()

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mumbai_air.db")
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "station_cache")
RESULTS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "station_audit_results.json")
os.makedirs(CACHE_DIR, exist_ok=True)


async def get_locations(client: httpx.AsyncClient, api_key: str):
    headers = {"X-API-Key": api_key}
    url = "https://api.openaq.org/v3/locations?coordinates=19.0760,72.8777&radius=25000&limit=50"
    resp = await client.get(url, headers=headers)
    resp.raise_for_status()
    return resp.json().get("results", [])


async def fetch_sensor_hours(client: httpx.AsyncClient, api_key: str, sensor_id: int, max_pages: int = 15):
    """
    Paginate /sensors/{sensor_id}/hours, caching each page to disk.
    Respects rate limits with exponential backoff on 429.
    """
    headers = {"X-API-Key": api_key}
    all_results = []
    page = 1

    while page <= max_pages:
        cache_file = os.path.join(CACHE_DIR, f"{sensor_id}_page_{page}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    page_data = json.load(f)
                results = page_data.get("results", [])
                all_results.extend(results)
                if not results or len(results) < 1000:
                    break
                page += 1
                continue
            except Exception:
                pass

        # Fetch from API
        url = f"https://api.openaq.org/v3/sensors/{sensor_id}/hours?limit=1000&page={page}"
        retries = 3
        success = False
        while retries > 0:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 429:
                    print(f"Rate limited (429) on sensor {sensor_id} page {page}. Sleeping 3s...")
                    await asyncio.sleep(3.0)
                    retries -= 1
                    continue
                elif resp.status_code != 200:
                    print(f"Sensor {sensor_id} page {page} returned status {resp.status_code}")
                    break

                page_data = resp.json()
                results = page_data.get("results", [])
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(page_data, f)
                all_results.extend(results)
                success = True
                break
            except Exception as e:
                print(f"Fetch error for sensor {sensor_id} page {page}: {e}")
                retries -= 1
                await asyncio.sleep(2.0)

        if not success:
            break

        if not results or len(results) < 1000:
            break

        page += 1
        await asyncio.sleep(0.25)

    return all_results


def clean_station_series(raw_records: list):
    """
    Parse raw hourly records, detect:
    - Negatives (< 0)
    - Outliers (> 1000)
    - Flatlines (consecutive identical values > 6 hours)
    Returns cleaned dataframe, audit stats, and monthly missingness.
    """
    if not raw_records:
        return None, {
            "first_ts": None,
            "last_ts": None,
            "total_raw": 0,
            "count_negative": 0,
            "count_above_1000": 0,
            "count_flatline": 0,
            "usable_hours": 0,
            "monthly_missing_pct": {},
        }

    rows = []
    for r in raw_records:
        period = r.get("period", {})
        dt_to = period.get("datetimeTo", {})
        dt_utc_str = dt_to.get("utc")
        dt_loc_str = dt_to.get("local")
        val = r.get("value")
        if dt_utc_str and val is not None:
            try:
                val_flt = float(val)
                rows.append({"timestamp_utc": dt_utc_str, "timestamp_local": dt_loc_str, "pm2_5": val_flt})
            except Exception:
                pass

    if not rows:
        return None, {
            "first_ts": None,
            "last_ts": None,
            "total_raw": 0,
            "count_negative": 0,
            "count_above_1000": 0,
            "count_flatline": 0,
            "usable_hours": 0,
            "monthly_missing_pct": {},
        }

    df = pd.DataFrame(rows).drop_duplicates(subset=["timestamp_utc"]).sort_values("timestamp_utc").reset_index(drop=True)
    total_raw = len(df)
    first_ts = df["timestamp_utc"].iloc[0]
    last_ts = df["timestamp_utc"].iloc[-1]

    # 1. Negative values
    neg_mask = df["pm2_5"] < 0
    count_negative = int(neg_mask.sum())

    # 2. Values > 1000
    above_1000_mask = df["pm2_5"] > 1000
    count_above_1000 = int(above_1000_mask.sum())

    # 3. Flatline runs > 6h (identical consecutive values)
    # Detect runs: group consecutive identical values
    df["val_diff"] = (df["pm2_5"] != df["pm2_5"].shift(1)).cumsum()
    run_lengths = df.groupby("val_diff")["pm2_5"].transform("count")
    flatline_mask = run_lengths > 6
    count_flatline = int(flatline_mask.sum())

    # Clean mask: must NOT be negative, NOT > 1000, and NOT flatline > 6h
    clean_mask = (~neg_mask) & (~above_1000_mask) & (~flatline_mask)
    clean_df = df[clean_mask].copy().reset_index(drop=True)
    usable_hours = len(clean_df)

    # 4. Monthly missingness for last 12 months (Oct 2025 to Sep 2026 + Oct 2026)
    clean_df["dt"] = pd.to_datetime(clean_df["timestamp_utc"])
    clean_df["month_str"] = clean_df["dt"].dt.strftime("%Y-%m")

    # Define last 12 months up to 2026-10
    months_list = [
        "2025-10", "2025-11", "2025-12",
        "2026-01", "2026-02", "2026-03",
        "2026-04", "2026-05", "2026-06",
        "2026-07", "2026-08", "2026-09", "2026-10"
    ]

    monthly_missing_pct = {}
    for ym in months_list:
        y, m = map(int, ym.split("-"))
        # Expected hours in that month
        if ym == "2026-10":
            # Up to Oct 14 14:00 (approx 326 hours)
            expected_hrs = 326
        elif m in [1, 3, 5, 7, 8, 10, 12]:
            expected_hrs = 31 * 24
        elif m in [4, 6, 9, 11]:
            expected_hrs = 30 * 24
        else: # Feb 2026 (non-leap year)
            expected_hrs = 28 * 24

        actual_hrs = int((clean_df["month_str"] == ym).sum())
        missing_pct = round(max(0.0, min(100.0, (1.0 - actual_hrs / expected_hrs) * 100.0)), 1)
        monthly_missing_pct[ym] = missing_pct

    stats = {
        "first_ts": first_ts,
        "last_ts": last_ts,
        "total_raw": total_raw,
        "count_negative": count_negative,
        "count_above_1000": count_above_1000,
        "count_flatline": count_flatline,
        "usable_hours": usable_hours,
        "monthly_missing_pct": monthly_missing_pct,
    }
    return clean_df, stats


def init_station_hourly_table(db_path: str = DB_PATH):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS station_hourly (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id TEXT NOT NULL,
            station_name TEXT NOT NULL,
            sensor_id INTEGER NOT NULL,
            timestamp_utc TEXT NOT NULL,
            timestamp_local TEXT NOT NULL,
            pm2_5 REAL NOT NULL,
            UNIQUE(station_id, timestamp_utc)
        );
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_station_hourly_time ON station_hourly (timestamp_utc);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_station_hourly_station ON station_hourly (station_id);")
    conn.commit()
    conn.close()


def save_station_hourly(clean_df: pd.DataFrame, station_id: str, station_name: str, sensor_id: int, db_path: str = DB_PATH):
    if clean_df is None or clean_df.empty:
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    records = []
    for _, row in clean_df.iterrows():
        records.append((
            str(station_id),
            str(station_name),
            int(sensor_id),
            str(row["timestamp_utc"]),
            str(row["timestamp_local"]),
            float(row["pm2_5"]),
        ))
    cur.executemany(
        """
        INSERT OR REPLACE INTO station_hourly (station_id, station_name, sensor_id, timestamp_utc, timestamp_local, pm2_5)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        records,
    )
    conn.commit()
    conn.close()


def compute_cams_vs_station(station_id: str, db_path: str = DB_PATH):
    """
    Compare Open-Meteo CAMS PM2.5 with physical station PM2.5 over their overlap:
    - Mean bias (CAMS - Station)
    - MAE
    - Correlation r
    - Seasonal breakdown
    - High PM2.5 bias (>60 and >100 ug/m3)
    """
    conn = sqlite3.connect(db_path)
    query = """
    SELECT s.timestamp_utc, s.timestamp_local, s.pm2_5 AS station_pm25, h.pm2_5 AS cams_pm25
    FROM station_hourly s
    JOIN hourly_records h ON substr(s.timestamp_utc, 1, 19) = substr(h.timestamp_utc, 1, 19)
    WHERE s.station_id = ? AND s.pm2_5 IS NOT NULL AND h.pm2_5 IS NOT NULL
    ORDER BY s.timestamp_utc ASC
    """
    df = pd.read_sql_query(query, conn, params=(str(station_id),))
    conn.close()

    if df.empty or len(df) < 50:
        return None

    y_stat = df["station_pm25"].values
    y_cams = df["cams_pm25"].values
    n = len(df)

    mean_bias = float(np.mean(y_cams - y_stat))
    mae = float(np.mean(np.abs(y_cams - y_stat)))
    corr = float(np.corrcoef(y_cams, y_stat)[0, 1]) if np.std(y_cams) > 0 and np.std(y_stat) > 0 else 0.0

    # High PM2.5 subsets
    high_60_mask = y_stat >= 60.0
    n_high_60 = int(high_60_mask.sum())
    bias_high_60 = float(np.mean(y_cams[high_60_mask] - y_stat[high_60_mask])) if n_high_60 > 0 else None

    high_100_mask = y_stat >= 100.0
    n_high_100 = int(high_100_mask.sum())
    bias_high_100 = float(np.mean(y_cams[high_100_mask] - y_stat[high_100_mask])) if n_high_100 > 0 else None

    # Seasonal breakdown
    df["dt"] = pd.to_datetime(df["timestamp_utc"])
    df["month"] = df["dt"].dt.month

    # Seasons in Mumbai:
    # Winter: Dec, Jan, Feb (12, 1, 2)
    # Summer / Pre-Monsoon: Mar, Apr, May (3, 4, 5)
    # Monsoon: Jun, Jul, Aug, Sep (6, 7, 8, 9)
    # Post-Monsoon: Oct, Nov (10, 11)
    seasons = {
        "Winter": [12, 1, 2],
        "Pre-Monsoon": [3, 4, 5],
        "Monsoon": [6, 7, 8, 9],
        "Post-Monsoon": [10, 11],
    }
    season_metrics = {}
    for s_name, m_list in seasons.items():
        s_df = df[df["month"].isin(m_list)]
        if not s_df.empty:
            s_stat = s_df["station_pm25"].values
            s_cams = s_df["cams_pm25"].values
            s_bias = float(np.mean(s_cams - s_stat))
            s_mae = float(np.mean(np.abs(s_cams - s_stat)))
            s_corr = float(np.corrcoef(s_cams, s_stat)[0, 1]) if np.std(s_cams) > 0 and np.std(s_stat) > 0 else 0.0
            season_metrics[s_name] = {
                "n_hours": len(s_df),
                "station_mean": round(float(np.mean(s_stat)), 1),
                "cams_mean": round(float(np.mean(s_cams)), 1),
                "mean_bias": round(s_bias, 2),
                "mae": round(s_mae, 2),
                "correlation": round(s_corr, 3),
            }

    return {
        "n_overlap_hours": n,
        "first_overlap": df["timestamp_utc"].iloc[0],
        "last_overlap": df["timestamp_utc"].iloc[-1],
        "overall": {
            "station_mean": round(float(np.mean(y_stat)), 1),
            "cams_mean": round(float(np.mean(y_cams)), 1),
            "mean_bias": round(mean_bias, 2),
            "mae": round(mae, 2),
            "correlation": round(corr, 3),
        },
        "high_pm25_bias": {
            "threshold_60": {"n_hours": n_high_60, "mean_bias": round(bias_high_60, 2) if bias_high_60 else None},
            "threshold_100": {"n_hours": n_high_100, "mean_bias": round(bias_high_100, 2) if bias_high_100 else None},
        },
        "seasons": season_metrics,
    }


def score_7day_station_overlap(station_id: str, db_path: str = DB_PATH):
    """
    Score the Atlas model forecast issued each hour over the last 7 days of overlap
    against what the physical station actually recorded 1, 6, 12, and 24 hours later.
    Evaluates MAE of Atlas vs Persistence on the station series.
    """
    import joblib
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "lgbm_model.pkl")
    if not os.path.exists(model_path):
        return None

    artifact = joblib.load(model_path)
    per_h_models = artifact.get("per_horizon_models", {})
    h_cols = artifact.get("h_cols", [])

    conn = sqlite3.connect(db_path)
    # Join station hourly with weather features from hourly_records
    query = """
    SELECT s.timestamp_utc, s.timestamp_local, s.pm2_5 AS station_pm25,
           h.pm2_5 AS cams_pm25,
           h.temperature_2m, h.relative_humidity_2m, h.wind_speed_10m, h.wind_direction_10m
    FROM station_hourly s
    JOIN hourly_records h ON substr(s.timestamp_utc, 1, 19) = substr(h.timestamp_utc, 1, 19)
    WHERE s.station_id = ? AND s.pm2_5 IS NOT NULL AND h.pm2_5 IS NOT NULL
    ORDER BY s.timestamp_utc ASC
    """
    df = pd.read_sql_query(query, conn, params=(str(station_id),))
    conn.close()

    if df.empty or len(df) < 168 + 24: # Need at least 7 days (168h) + 24h lead
        return None

    # Take last 168 issue hours (last 7 days of available overlap)
    test_start_idx = len(df) - 168 - 24
    if test_start_idx < 24:
        test_start_idx = 24

    issue_indices = range(test_start_idx, len(df) - 24)
    horizons = [1, 6, 12, 24]

    results_by_h = {h: {
        "actual": [],
        "atlas_hybrid_pred": [],
        "atlas_production_cams_pred": [],
        "persistence_pred": [],
    } for h in horizons}

    for idx in issue_indices:
        current_stat_val = float(df["station_pm25"].iloc[idx])
        current_cams_val = float(df["cams_pm25"].iloc[idx])

        # Lags on station series (for hybrid test)
        s_l1 = float(df["station_pm25"].iloc[idx])
        s_l2 = float(df["station_pm25"].iloc[idx - 1])
        s_l3 = float(df["station_pm25"].iloc[idx - 2])
        s_l6 = float(df["station_pm25"].iloc[idx - 5])
        s_l24 = float(df["station_pm25"].iloc[idx - 23])
        s_roll_6 = float(df["station_pm25"].iloc[idx - 5 : idx + 1].mean())
        s_roll_std_6 = float(df["station_pm25"].iloc[idx - 5 : idx + 1].std())
        s_roll_24 = float(df["station_pm25"].iloc[idx - 23 : idx + 1].mean())

        # Lags on CAMS series (for deployed production test)
        c_l1 = float(df["cams_pm25"].iloc[idx])
        c_l2 = float(df["cams_pm25"].iloc[idx - 1])
        c_l3 = float(df["cams_pm25"].iloc[idx - 2])
        c_l6 = float(df["cams_pm25"].iloc[idx - 5])
        c_l24 = float(df["cams_pm25"].iloc[idx - 23])
        c_roll_6 = float(df["cams_pm25"].iloc[idx - 5 : idx + 1].mean())
        c_roll_std_6 = float(df["cams_pm25"].iloc[idx - 5 : idx + 1].std())
        c_roll_24 = float(df["cams_pm25"].iloc[idx - 23 : idx + 1].mean())

        for h in horizons:
            target_idx = idx + h
            if target_idx >= len(df):
                continue
            actual_val = float(df["station_pm25"].iloc[target_idx])

            # Persistence prediction: current station value at issue time
            persist_val = current_stat_val

            # Future weather at target hour
            tgt_temp = float(df["temperature_2m"].iloc[target_idx])
            tgt_rh = float(df["relative_humidity_2m"].iloc[target_idx])
            tgt_ws = float(df["wind_speed_10m"].iloc[target_idx])
            tgt_wd_rad = np.radians(float(df["wind_direction_10m"].iloc[target_idx]))
            tgt_u = float(-tgt_ws * np.sin(tgt_wd_rad))
            tgt_v = float(-tgt_ws * np.cos(tgt_wd_rad))
            tgt_hour = pd.to_datetime(df["timestamp_local"].iloc[target_idx]).hour

            # Hybrid features (station lags)
            row_hybrid = {
                "pm2_5_lag_1": s_l1,
                "pm2_5_lag_2": s_l2,
                "pm2_5_lag_3": s_l3,
                "pm2_5_lag_6": s_l6,
                "pm2_5_lag_24": s_l24,
                "pm2_5_roll_mean_6": s_roll_6,
                "pm2_5_roll_std_6": s_roll_std_6,
                "pm2_5_roll_mean_24": s_roll_24,
                "future_temp": tgt_temp,
                "future_rh": tgt_rh,
                "future_wind": tgt_ws,
                "future_u": tgt_u,
                "future_v": tgt_v,
                "future_hour_sin": np.sin(2 * np.pi * tgt_hour / 24.0),
                "future_hour_cos": np.cos(2 * np.pi * tgt_hour / 24.0),
            }

            # Production features (CAMS lags)
            row_cams = {
                "pm2_5_lag_1": c_l1,
                "pm2_5_lag_2": c_l2,
                "pm2_5_lag_3": c_l3,
                "pm2_5_lag_6": c_l6,
                "pm2_5_lag_24": c_l24,
                "pm2_5_roll_mean_6": c_roll_6,
                "pm2_5_roll_std_6": c_roll_std_6,
                "pm2_5_roll_mean_24": c_roll_24,
                "future_temp": tgt_temp,
                "future_rh": tgt_rh,
                "future_wind": tgt_ws,
                "future_u": tgt_u,
                "future_v": tgt_v,
                "future_hour_sin": np.sin(2 * np.pi * tgt_hour / 24.0),
                "future_hour_cos": np.cos(2 * np.pi * tgt_hour / 24.0),
            }

            if h in per_h_models:
                hyb_df = pd.DataFrame([row_hybrid])[h_cols]
                hyb_delta = float(per_h_models[h].predict(hyb_df)[0])
                atlas_hybrid_val = max(3.0, current_stat_val + hyb_delta)

                cams_df = pd.DataFrame([row_cams])[h_cols]
                cams_delta = float(per_h_models[h].predict(cams_df)[0])
                atlas_prod_val = max(3.0, current_cams_val + cams_delta)
            else:
                atlas_hybrid_val = current_stat_val
                atlas_prod_val = current_cams_val

            results_by_h[h]["actual"].append(actual_val)
            results_by_h[h]["atlas_hybrid_pred"].append(atlas_hybrid_val)
            results_by_h[h]["atlas_production_cams_pred"].append(atlas_prod_val)
            results_by_h[h]["persistence_pred"].append(persist_val)

    scorecard = {}
    for h in horizons:
        y_act = np.array(results_by_h[h]["actual"])
        y_hyb = np.array(results_by_h[h]["atlas_hybrid_pred"])
        y_prod = np.array(results_by_h[h]["atlas_production_cams_pred"])
        y_per = np.array(results_by_h[h]["persistence_pred"])
        n_eval = len(y_act)
        if n_eval > 0:
            mae_hyb = float(np.mean(np.abs(y_act - y_hyb)))
            mae_prod = float(np.mean(np.abs(y_act - y_prod)))
            mae_per = float(np.mean(np.abs(y_act - y_per)))

            scorecard[f"t+{h}h"] = {
                "n_eval_hours": n_eval,
                "station_mean": round(float(np.mean(y_act)), 1),
                "persistence_mae": round(mae_per, 2),
                "atlas_hybrid_mae": round(mae_hyb, 2),
                "atlas_production_cams_mae": round(mae_prod, 2),
                "delta_hybrid_vs_persistence": round(mae_hyb - mae_per, 2),
                "delta_prod_vs_persistence": round(mae_prod - mae_per, 2),
                "hybrid_verdict": "HYBRID WINS" if mae_hyb < mae_per else "PERSISTENCE WINS",
                "prod_verdict": "PROD ATLAS WINS" if mae_prod < mae_per else "PERSISTENCE WINS",
            }

    return scorecard


async def main():
    api_key = os.getenv("OPENAQ_API_KEY")
    if not api_key:
        print("ERROR: OPENAQ_API_KEY not found in environment.")
        sys.exit(1)

    print("Initializing SQLite station_hourly table...")
    init_station_hourly_table(DB_PATH)

    async with httpx.AsyncClient(timeout=20.0) as client:
        print("Fetching Mumbai locations from OpenAQ v3...")
        locations = await get_locations(client, api_key)
        print(f"Total locations found: {len(locations)}")

        # Find PM2.5 sensors
        station_sensor_map = []
        for loc in locations:
            lid = str(loc["id"])
            name = loc.get("name", "Unknown Station")
            sensors = loc.get("sensors", [])
            # Find pm25 sensors
            pm25_sensors = [s["id"] for s in sensors if s.get("parameter", {}).get("name") == "pm25"]
            if pm25_sensors:
                # Prioritize highest sensor ID (usually newest)
                chosen_sid = max(pm25_sensors)
                dt_last = loc.get("datetimeLast", {}).get("utc")
                station_sensor_map.append({
                    "station_id": lid,
                    "station_name": name,
                    "sensor_id": chosen_sid,
                    "all_sensors": pm25_sensors,
                    "last_timestamp": dt_last,
                })

        print(f"Stations with PM2.5 sensors: {len(station_sensor_map)}")

        sem = asyncio.Semaphore(4)

        async def process_station(i, s_info):
            async with sem:
                sid = s_info["sensor_id"]
                st_name = s_info["station_name"]
                st_id = s_info["station_id"]
                print(f"[{i+1}/{len(station_sensor_map)}] Auditing station {st_name} (ID: {st_id}, Sensor: {sid})...", flush=True)

                raw_hours = await fetch_sensor_hours(client, api_key, sid)
                clean_df, stats = clean_station_series(raw_hours)

                print(f" -> Completed {st_name}: {stats['usable_hours']} usable hours (raw: {stats['total_raw']}, neg: {stats['count_negative']}, >1000: {stats['count_above_1000']}, flatline: {stats['count_flatline']})", flush=True)
                return (clean_df, {
                    "station_id": st_id,
                    "station_name": st_name,
                    "sensor_id": sid,
                    "last_active": s_info["last_timestamp"],
                    **stats,
                })

        tasks = [process_station(i, s_info) for i, s_info in enumerate(station_sensor_map)]
        processed = await asyncio.gather(*tasks)

        audit_results = []
        for clean_df, st_stats in processed:
            if clean_df is not None and not clean_df.empty:
                save_station_hourly(clean_df, st_stats["station_id"], st_stats["station_name"], st_stats["sensor_id"], DB_PATH)
            audit_results.append(st_stats)

    # Rank stations by usable hours
    audit_results.sort(key=lambda x: x["usable_hours"], reverse=True)

    print("\n" + "="*80)
    print("STATION AUDIT RANKING (BY USABLE HOURS):")
    print("="*80)
    for rank, st in enumerate(audit_results, 1):
        print(f"{rank:2d}. {st['station_name'][:32]:32} | ID: {st['station_id']:7} | Usable: {st['usable_hours']:5d}h | Raw: {st['total_raw']:5d} | Neg: {st['count_negative']:3d} | >1000: {st['count_above_1000']:3d} | Flatline>6h: {st['count_flatline']:4d}")

    # Filter stations that overlap with CAMS archive (active in 2024-2026)
    cams_overlapping = [
        st for st in audit_results
        if st.get("last_active") and str(st["last_active"]) >= "2024-09-01"
    ]
    top_3 = cams_overlapping[:3] if len(cams_overlapping) >= 3 else audit_results[:3]

    print("\nTOP 3 CAMS-OVERLAPPING STATIONS IDENTIFIED:")
    for st in top_3:
        print(f" - {st['station_name']} (ID: {st['station_id']}) with {st['usable_hours']} usable hours")

    # Item 2: CAMS vs Station comparison for top 3 (plus BKC if not in top 3)
    print("\n" + "="*80)
    print("ITEM 2: CAMS VS STATION COMPARISONS")
    print("="*80)
    stations_to_compare = list(top_3)
    bkc_st = next((st for st in audit_results if st["station_id"] == "3409482"), None)
    if bkc_st and bkc_st not in stations_to_compare:
        stations_to_compare.append(bkc_st)

    cams_comparisons = {}
    for st in stations_to_compare:
        comp = compute_cams_vs_station(st["station_id"], DB_PATH)
        cams_comparisons[st["station_id"]] = {
            "station_name": st["station_name"],
            "comparison": comp,
        }
        if comp:
            print(f"\nStation: {st['station_name']} (ID: {st['station_id']})")
            print(f"Overlap hours: {comp['n_overlap_hours']} ({comp['first_overlap']} to {comp['last_overlap']})")
            print(f"Overall Station Mean: {comp['overall']['station_mean']} ug/m3 | CAMS Mean: {comp['overall']['cams_mean']} ug/m3")
            print(f"Mean Bias (CAMS - Station): {comp['overall']['mean_bias']:+5.2f} ug/m3 | MAE: {comp['overall']['mae']} ug/m3 | Correlation r: {comp['overall']['correlation']}")
            print(f"High PM2.5 Bias (>=60 ug/m3): {comp['high_pm25_bias']['threshold_60']['mean_bias']} ug/m3 (n={comp['high_pm25_bias']['threshold_60']['n_hours']})")
            print(f"High PM2.5 Bias (>=100 ug/m3): {comp['high_pm25_bias']['threshold_100']['mean_bias']} ug/m3 (n={comp['high_pm25_bias']['threshold_100']['n_hours']})")
            print("Seasonal Breakdown:")
            for s_name, s_data in comp["seasons"].items():
                print(f"  {s_name:12}: n={s_data['n_hours']:4d} | Stat: {s_data['station_mean']:4.1f} | CAMS: {s_data['cams_mean']:4.1f} | Bias: {s_data['mean_bias']:+5.2f} | MAE: {s_data['mae']:4.2f} | r: {s_data['correlation']:.3f}")

    # Item 3: 7-day Atlas scoring on station series for Bandra Kurla Complex (MPCB)
    print("\n" + "="*80)
    print("ITEM 3: 7-DAY ATLAS FORECAST SCORING ON STATION ACTUALS")
    print("="*80)
    target_bkc_id = "3409482" if bkc_st else top_3[0]["station_id"]
    score_7d_bkc = score_7day_station_overlap(target_bkc_id, DB_PATH)
    if score_7d_bkc:
        print(f"\n7-Day Scoring against physical station actuals for BKC (ID: {target_bkc_id}):")
        for h_str, h_res in score_7d_bkc.items():
            print(f"  {h_str:6}: n={h_res['n_eval_hours']} | Station Mean: {h_res['station_mean']} ug/m3")
            print(f"          Persistence MAE: {h_res['persistence_mae']} ug/m3")
            print(f"          Atlas Hybrid MAE: {h_res['atlas_hybrid_mae']} ug/m3 (Delta vs Persist: {h_res['delta_hybrid_vs_persistence']:+5.2f} ug/m3) -> {h_res['hybrid_verdict']}")
            print(f"          Atlas Prod CAMS MAE: {h_res['atlas_production_cams_mae']} ug/m3 (Delta vs Persist: {h_res['delta_prod_vs_persistence']:+5.2f} ug/m3) -> {h_res['prod_verdict']}")

    # Also score top station (11606)
    score_7d_top = score_7day_station_overlap(top_3[0]["station_id"], DB_PATH)

    # Save full results to disk
    full_output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_stations_audited": len(audit_results),
        "rankings": audit_results,
        "cams_comparisons": cams_comparisons,
        "score_7day_bkc": score_7d_bkc,
        "score_7day_top_station": {
            "station_id": top_3[0]["station_id"],
            "station_name": top_3[0]["station_name"],
            "scorecard": score_7d_top,
        },
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(full_output, f, indent=2)
    print(f"\nAudit complete. Full results written to {RESULTS_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
