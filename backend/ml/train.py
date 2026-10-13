"""
Model training and chronological evaluation pipeline for Mumbai Air Atlas.
Trains a LightGBM regressor on engineered meteorological and lagged features,
evaluates on a strictly held-out chronological test partition, and saves metrics.
"""

import sys
import os

# Ensure project root is in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import json
import sqlite3
import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from backend.ml.features import build_features

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mumbai_air.db")
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "lgbm_model.pkl")
METRICS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "model_metrics.json")


def train_and_evaluate(db_path: str = DB_PATH) -> dict:
    conn = sqlite3.connect(db_path)
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

    if df.empty or len(df) < 100:
        raise ValueError(f"Insufficient training records in {db_path}: {len(df)}")

    # 1. Feature Engineering
    featured_df, feature_cols = build_features(df)

    # 2. Add naive baselines for comparison on the same test slice
    featured_df["baseline_24h_pred"] = featured_df["pm2_5"].shift(24)
    featured_df["baseline_1h_pred"] = featured_df["pm2_5"].shift(1)

    # Drop warm-up rows where lags are undefined
    valid_df = featured_df.dropna(subset=["pm2_5", "baseline_24h_pred"] + feature_cols).copy()

    # 3. Chronological Train/Test Split (Never random)
    split_idx = int(len(valid_df) * 0.8)
    train_df = valid_df.iloc[:split_idx]
    test_df = valid_df.iloc[split_idx:]

    X_train = train_df[feature_cols]
    y_train = train_df["pm2_5"]

    X_test = test_df[feature_cols]
    y_test = test_df["pm2_5"]

    # 4. Train LightGBM Regressor
    model = LGBMRegressor(
        n_estimators=160,
        learning_rate=0.04,
        num_leaves=28,
        min_child_samples=15,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        verbosity=-1,
    )
    model.fit(X_train, y_train)

    # 5. Evaluate on held-out test partition
    y_pred = model.predict(X_test)
    y_test_arr = y_test.values
    y_base_24h = test_df["baseline_24h_pred"].values
    y_base_1h = test_df["baseline_1h_pred"].values

    # Model metrics
    mae_model = float(np.mean(np.abs(y_test_arr - y_pred)))
    rmse_model = float(np.sqrt(np.mean((y_test_arr - y_pred) ** 2)))

    # Baseline metrics on exact same test partition
    mae_base_24h = float(np.mean(np.abs(y_test_arr - y_base_24h)))
    rmse_base_24h = float(np.sqrt(np.mean((y_test_arr - y_base_24h) ** 2)))

    mae_base_1h = float(np.mean(np.abs(y_test_arr - y_base_1h)))
    rmse_base_1h = float(np.sqrt(np.mean((y_test_arr - y_base_1h) ** 2)))

    # Improvement against 24h diurnal persistence
    improvement_vs_24h_pct = float(((mae_base_24h - mae_model) / mae_base_24h) * 100)
    beats_baseline = mae_model < mae_base_24h

    # Feature importances
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    top_features = [
        {"feature": feature_cols[i], "importance": int(importances[i])}
        for i in sorted_idx[:8]
    ]

    metrics = {
        "model_name": "Atlas LightGBM Regressor",
        "algorithm": "Gradient Boosted Decision Trees (LightGBM)",
        "split_method": "Chronological forward partition (80% train, 20% test)",
        "target_variable": "pm2_5 (µg/m³)",
        "train_observations": len(train_df),
        "test_observations": len(test_df),
        "test_period_start": str(test_df["timestamp_local"].iloc[0]),
        "test_period_end": str(test_df["timestamp_local"].iloc[-1]),
        "scores": {
            "lightgbm_model": {
                "mae": round(mae_model, 2),
                "rmse": round(rmse_model, 2),
                "unit": "µg/m³",
            },
            "baseline_24h_persistence": {
                "mae": round(mae_base_24h, 2),
                "rmse": round(rmse_base_24h, 2),
                "unit": "µg/m³",
            },
            "baseline_1h_persistence": {
                "mae": round(mae_base_1h, 2),
                "rmse": round(rmse_base_1h, 2),
                "unit": "µg/m³",
            },
        },
        "evaluation_verdict": {
            "beats_24h_baseline": beats_baseline,
            "improvement_pct": round(improvement_vs_24h_pct, 1),
            "honest_statement": (
                f"LightGBM achieved {round(mae_model, 2)} µg/m³ MAE, outperforming the 24-hour diurnal "
                f"persistence baseline ({round(mae_base_24h, 2)} µg/m³ MAE) by {round(improvement_vs_24h_pct, 1)}% "
                f"on the held-out test partition."
                if beats_baseline
                else f"LightGBM ({round(mae_model, 2)} µg/m³ MAE) did not outperform the baseline ({round(mae_base_24h, 2)} µg/m³)."
            ),
        },
        "top_features": top_features,
    }

    # Save artifacts
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({"model": model, "feature_cols": feature_cols}, MODEL_PATH)

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return metrics


if __name__ == "__main__":
    res = train_and_evaluate()
    print("=" * 64)
    print("MUMBAI AIR ATLAS — LIGHTGBM EVALUATION SCORECARD")
    print("=" * 64)
    print(f"Target: {res['target_variable']}")
    print(f"Sample size: {res['train_observations']} train, {res['test_observations']} test")
    print(f"Holdout Window: {res['test_period_start']} -> {res['test_period_end']}")
    print("-" * 64)
    print(f"24-Hour Diurnal Baseline MAE: {res['scores']['baseline_24h_persistence']['mae']} µg/m³")
    print(f"1-Hour Persistence Baseline MAE: {res['scores']['baseline_1h_persistence']['mae']} µg/m³")
    print(f"Atlas LightGBM Model MAE:      {res['scores']['lightgbm_model']['mae']} µg/m³")
    print(f"Atlas LightGBM Model RMSE:     {res['scores']['lightgbm_model']['rmse']} µg/m³")
    print("-" * 64)
    print(f"Improvement vs 24h Baseline:   {res['evaluation_verdict']['improvement_pct']}%")
    print(f"Verdict: {res['evaluation_verdict']['honest_statement']}")
    print("=" * 64)
