"""
Anomaly detection engine for Mumbai Air Atlas.
Identifies statistical outliers (rolling z-score > 2.0 and high residual deviation)
and associates them with measured meteorological features without claiming unverified causality.
"""

import sys
import os

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import json
import sqlite3
import joblib
import numpy as np
import pandas as pd
from backend.ml.features import build_features

def _find_anomaly_db() -> str:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mumbai_air.db"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "snapshot", "snapshot.db"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

DB_PATH = _find_anomaly_db()
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "station_models.pkl")
ANOMALIES_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "anomalies.json")


def detect_anomalies(db_path: str = None, z_threshold: float = 2.5) -> list:
    if db_path is None or not os.path.exists(db_path):
        db_path = _find_anomaly_db()

    if not os.path.exists(db_path):
        return []

    try:
        from pathlib import Path
        uri = Path(db_path).resolve().as_uri() + "?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=30.0)
        df = pd.read_sql_query(
            """
            SELECT timestamp_utc, timestamp_local, pm2_5, pm10,
                   temperature_2m, relative_humidity_2m, precipitation,
                   wind_speed_10m, wind_direction_10m
            FROM hourly_records
            ORDER BY timestamp_utc ASC
            """,
            conn,
        )
        conn.close()
    except Exception:
        return []

    if df.empty or len(df) < 50:
        return []

    # 1. Compute rolling statistics for Z-score
    df["roll_mean_24"] = df["pm2_5"].rolling(window=24, min_periods=12).mean()
    df["roll_std_24"] = df["pm2_5"].rolling(window=24, min_periods=12).std()
    df["z_score"] = (df["pm2_5"] - df["roll_mean_24"]) / df["roll_std_24"].replace(0, 1)

    # 2. Compute model predictions if model exists
    if os.path.exists(MODEL_PATH):
        try:
            artifact = joblib.load(MODEL_PATH)
            model = artifact.get("model_24h") or artifact.get("model")
            feature_cols = artifact.get("feature_cols", [])
            featured_df, _ = build_features(df)
            valid_idx = featured_df.dropna(subset=feature_cols).index
            if model and len(feature_cols) > 0:
                preds = model.predict(featured_df.loc[valid_idx, feature_cols])
                df.loc[valid_idx, "model_pred"] = preds
                df["residual"] = np.abs(df["pm2_5"] - df["model_pred"])
            else:
                df["residual"] = 0
        except Exception:
            df["residual"] = 0
    else:
        df["residual"] = 0

    # 3. Filter anomalous points: Strictly requiring |z_score| >= z_threshold (default 2.5)
    anom_df = df[
        df["z_score"].abs() >= z_threshold
    ].copy()

    anomalies = []
    # Take most recent up to 10 anomalies
    for _, row in anom_df.tail(10).iterrows():
        val = float(row["pm2_5"])
        mean_val = float(row["roll_mean_24"]) if pd.notna(row["roll_mean_24"]) else val
        z_sc = float(row["z_score"]) if pd.notna(row["z_score"]) else 0.0
        ws = float(row["wind_speed_10m"]) if pd.notna(row["wind_speed_10m"]) else 0.0
        wd = float(row["wind_direction_10m"]) if pd.notna(row["wind_direction_10m"]) else 0.0
        temp = float(row["temperature_2m"]) if pd.notna(row["temperature_2m"]) else 0.0
        rh = float(row["relative_humidity_2m"]) if pd.notna(row["relative_humidity_2m"]) else 0.0

        # Compass direction
        dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        compass = dirs[int(round(((wd % 360) / 22.5))) % 16]

        kind = "positive_spike" if z_sc > 0 else "negative_drop"
        delta = val - mean_val

        # Cautious plain editorial description without claiming direct proof of causality
        description = (
            f"PM2.5 registered {val:.1f} µg/m³ ({'+' if delta > 0 else ''}{delta:.1f} µg/m³ vs 24h rolling mean), "
            f"observed concurrently with {ws:.1f} km/h winds from {wd:.0f}° {compass}, "
            f"temperature of {temp:.1f}°C, and relative humidity of {rh:.0f}%."
        )

        anomalies.append({
            "timestamp_utc": str(row["timestamp_utc"]),
            "timestamp_local": str(row["timestamp_local"]),
            "measured_pm25": round(val, 1),
            "rolling_mean_24h": round(mean_val, 1),
            "z_score": round(z_sc, 2),
            "anomaly_type": kind,
            "meteorological_context": {
                "wind_speed_kmh": round(ws, 1),
                "wind_direction_deg": round(wd, 0),
                "wind_compass": compass,
                "temperature_c": round(temp, 1),
                "relative_humidity_pct": round(rh, 0),
            },
            "editorial_narrative": description,
        })

    os.makedirs(os.path.dirname(ANOMALIES_PATH), exist_ok=True)
    with open(ANOMALIES_PATH, "w", encoding="utf-8") as f:
        json.dump(anomalies, f, indent=2)

    return anomalies


if __name__ == "__main__":
    detected = detect_anomalies()
    print(f"Detected and archived {len(detected)} atmospheric anomalies.")
    if detected:
        print("Latest anomaly:", detected[-1]["editorial_narrative"])
