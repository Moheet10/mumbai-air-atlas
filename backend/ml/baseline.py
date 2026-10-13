"""
Naive persistence baseline evaluation for Mumbai Air Atlas.
Evaluates a 24-hour lag persistence baseline: PM2.5(t) = PM2.5(t - 24h).
Uses a chronological train/test split (no random split) to prevent data leakage.
"""

import os
import json
import sqlite3
import pandas as pd
import numpy as np

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mumbai_air.db")
METRICS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "baseline_metrics.json")


def evaluate_baseline(db_path: str = DB_PATH) -> dict:
    conn = sqlite3.connect(db_path)
    df = pd.read_sql_query(
        "SELECT timestamp_utc, timestamp_local, pm2_5, temperature_2m, relative_humidity_2m, wind_speed_10m FROM hourly_records ORDER BY timestamp_utc ASC",
        conn,
    )
    conn.close()

    if df.empty or len(df) < 48:
        raise ValueError(f"Insufficient data in {db_path} to evaluate 24h baseline. Records count: {len(df)}")

    # Ensure chronological order and proper indexing
    df["datetime"] = pd.to_datetime(df["timestamp_utc"])
    df = df.sort_values("datetime").reset_index(drop=True)

    # 24-hour persistence baseline: estimate PM2.5 at hour t using value from hour t - 24
    df["pm2_5_pred_24h_persistence"] = df["pm2_5"].shift(24)

    # 1-hour persistence baseline: estimate PM2.5 at hour t using value from hour t - 1
    df["pm2_5_pred_1h_persistence"] = df["pm2_5"].shift(1)

    # Drop warm-up rows
    valid_df = df.dropna(subset=["pm2_5", "pm2_5_pred_24h_persistence"]).copy()

    # Chronological train/test split (last 20% held out as test set)
    split_idx = int(len(valid_df) * 0.8)
    train_df = valid_df.iloc[:split_idx]
    test_df = valid_df.iloc[split_idx:]

    y_test = test_df["pm2_5"].values
    y_pred_24h = test_df["pm2_5_pred_24h_persistence"].values
    y_pred_1h = test_df["pm2_5_pred_1h_persistence"].values

    mae_24h = float(np.mean(np.abs(y_test - y_pred_24h)))
    rmse_24h = float(np.sqrt(np.mean((y_test - y_pred_24h) ** 2)))

    mae_1h = float(np.mean(np.abs(y_test - y_pred_1h)))
    rmse_1h = float(np.sqrt(np.mean((y_test - y_pred_1h) ** 2)))

    metrics = {
        "model_name": "Naive Persistence Baseline",
        "description": "Predicts current value equals value from 24 hours prior (diurnal cycle)",
        "split_method": "Chronological (80% train, 20% held-out test)",
        "total_records": len(valid_df),
        "test_records": len(test_df),
        "test_period_start": str(test_df["timestamp_local"].iloc[0]),
        "test_period_end": str(test_df["timestamp_local"].iloc[-1]),
        "target_variable": "pm2_5 (µg/m³)",
        "baseline_24h": {
            "mae": round(mae_24h, 2),
            "rmse": round(rmse_24h, 2),
            "unit": "µg/m³",
        },
        "baseline_1h": {
            "mae": round(mae_1h, 2),
            "rmse": round(rmse_1h, 2),
            "unit": "µg/m³",
        },
    }

    os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return metrics


if __name__ == "__main__":
    results = evaluate_baseline()
    print("=" * 60)
    print("MUMBAI AIR ATLAS — BASELINE EVALUATION REPORT")
    print("=" * 60)
    print(f"Target: {results['target_variable']}")
    print(f"Dataset: {results['total_records']} total hours, {results['test_records']} test hours")
    print(f"Test Window: {results['test_period_start']} -> {results['test_period_end']}")
    print("-" * 60)
    print(f"24-Hour Persistence Baseline:")
    print(f"  MAE:  {results['baseline_24h']['mae']} µg/m³")
    print(f"  RMSE: {results['baseline_24h']['rmse']} µg/m³")
    print("-" * 60)
    print(f"1-Hour Persistence Baseline:")
    print(f"  MAE:  {results['baseline_1h']['mae']} µg/m³")
    print(f"  RMSE: {results['baseline_1h']['rmse']} µg/m³")
    print("=" * 60)
