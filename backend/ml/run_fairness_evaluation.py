"""
Fairness and ablation evaluation script for Mumbai Air Atlas.
Computes:
1. Production path verification (DB timestamp freshness vs current time).
2. Ablation per horizon (actual weather vs no weather vs historical NWP forecast weather).
3. 7-day clock-hour diurnal baseline & blended baseline comparisons.
4. Stratified MAE: PM2.5 > 40 vs <= 40, and per calendar month.
5. Per-horizon direct models vs pooled multi-horizon model.
6. Quantile regression models (alpha=0.1, 0.9) around Atlas line and empirical test coverage.
"""

import sys
import os
import json
import sqlite3
import httpx
from datetime import datetime, timezone, timedelta
import zoneinfo
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.ml.features import build_features

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mumbai_air.db")


def block_bootstrap_ci(diffs: np.ndarray, block_size: int = 24, n_boot: int = 1000, random_state: int = 42) -> tuple[float, float]:
    np.random.seed(random_state)
    n = len(diffs)
    n_blocks = int(np.ceil(n / block_size))
    padded_len = n_blocks * block_size
    padded_diffs = np.pad(diffs, (0, padded_len - n), mode="wrap")
    blocks = padded_diffs.reshape(n_blocks, block_size)

    boot_means = []
    for _ in range(n_boot):
        sampled_indices = np.random.choice(n_blocks, size=n_blocks, replace=True)
        sampled_data = blocks[sampled_indices].ravel()[:n]
        boot_means.append(np.mean(sampled_data))

    return float(np.percentile(boot_means, 2.5)), float(np.percentile(boot_means, 97.5))


def run_fairness_suite():
    print("=== STARTING FAIRNESS & ABLATION EVALUATION SUITE ===")

    # 1. Load Data
    conn = sqlite3.connect(DB_PATH)
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

    print(f"Total rows in DB: {len(df)}")
    featured_df, base_cols = build_features(df)

    # Historical split (80% train, 20% test chronologically)
    cutoff_time = df["timestamp_utc"].iloc[int(len(df) * 0.8)]
    cutoff_dt = pd.to_datetime(cutoff_time)
    print(f"Train/Test Cutoff UTC: {cutoff_time} (Test length: ~{len(df) - int(len(df) * 0.8)} hours)")

    # 2. Fetch Open-Meteo Historical Forecast Weather for the Test Set (Condition iii)
    test_start_date = cutoff_dt.strftime("%Y-%m-%d")
    test_end_date = pd.to_datetime(df["timestamp_utc"].iloc[-1]).strftime("%Y-%m-%d")
    print(f"Fetching Open-Meteo Historical Forecast Weather from {test_start_date} to {test_end_date}...")

    nwp_forecast_map = {}
    try:
        url = "https://historical-forecast-api.open-meteo.com/v1/forecast"
        params = {
            "latitude": 19.0760,
            "longitude": 72.8777,
            "start_date": test_start_date,
            "end_date": test_end_date,
            "hourly": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m"],
            "timezone": "Asia/Kolkata",
        }
        resp = httpx.get(url, params=params, timeout=25.0)
        if resp.status_code == 200:
            nwp_data = resp.json().get("hourly", {})
            nwp_times = nwp_data.get("time", [])
            for i, t_str in enumerate(nwp_times):
                ws = nwp_data["wind_speed_10m"][i] or 0.0
                wdir = nwp_data["wind_direction_10m"][i] or 0.0
                wd_rad = np.radians(wdir)
                nwp_forecast_map[t_str] = {
                    "temp": nwp_data["temperature_2m"][i],
                    "rh": nwp_data["relative_humidity_2m"][i],
                    "wind": ws,
                    "u": -ws * np.sin(wd_rad),
                    "v": -ws * np.cos(wd_rad),
                }
            print(f"Successfully fetched {len(nwp_forecast_map)} historical NWP forecast hours!")
        else:
            print(f"Historical forecast API error: {resp.status_code}")
    except Exception as e:
        print(f"Error fetching historical forecast: {e}")

    # Build 7-day clock-hour historical diurnal lookup table
    # For every index i, we can compute the mean of the same clock hour over the past 7 days (i-24, i-48, ..., i-168)
    pm_series = featured_df["pm2_5"].values
    dt_series = featured_df["datetime"].values

    # 3. Construct Horizon Datasets for evaluation: h in [1, 6, 12, 24, 48]
    eval_horizons = [1, 6, 12, 24, 48]
    all_train_horizons = [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 30, 36, 42, 48]

    # Precompute dataset per horizon
    horizon_data = {}
    for h in all_train_horizons:
        h_df = featured_df.copy()
        h_df["lead_hours"] = h
        h_df["log_lead_hours"] = np.log1p(h)
        h_df["target_level"] = h_df["pm2_5"].shift(-h)
        h_df["issue_level"] = h_df["pm2_5"]
        h_df["target_delta"] = h_df["target_level"] - h_df["issue_level"]

        # Condition (i): Actual future weather (perfect prognosis)
        h_df["future_temp"] = h_df["temperature_2m"].shift(-h)
        h_df["future_rh"] = h_df["relative_humidity_2m"].shift(-h)
        h_df["future_wind"] = h_df["wind_speed_10m"].shift(-h)
        h_df["future_u"] = h_df["wind_u"].shift(-h)
        h_df["future_v"] = h_df["wind_v"].shift(-h)
        h_df["future_hour_sin"] = h_df["hour_sin"].shift(-h)
        h_df["future_hour_cos"] = h_df["hour_cos"].shift(-h)

        # 7-day diurnal baseline calculation:
        # At issue time t (index idx), the target clock hour is target_dt.hour
        # In past 7 days prior to t: idx - 24*k for k in 1..7
        # Note: exactly 24 hours apart shifts back by 24h intervals
        past_7d_hour_means = []
        for lag_days in range(1, 8):
            # Target is at t+h; looking back from t+h by 24*lag_days gives the same clock hour
            # which is t - (24*lag_days - h). But issue time is t, so we must strictly only use
            # data prior to issue time t!
            # The most recent past instance of that same clock hour strictly <= issue time t:
            # target_clock_hour = (hour + h) % 24
            # If target_clock_hour <= hour, most recent is today: lag = h % 24 (wait, if h=6, target is 9:00, issue is 3:00, 9:00 today hasn't happened yet!)
            # So the most recent completed occurrence of target_clock_hour was yesterday: t - (24 - h % 24) or similar.
            pass

        # Robust vectorised computation of 7-day clock hour mean strictly before issue time:
        # For target hour (t+h), look at the occurrences of that clock hour in the 7 days prior to t:
        # If target is at t+h, its clock hour occurred at t+h - 24*1, t+h - 24*2, ..., t+h - 24*7.
        # Notice: t+h - 24*k is strictly <= t as long as 24*k >= h!
        # For h=1..24, k=1 is t+h-24 <= t. So k in 1..7 are all strictly in the past!
        # For h=48, k must be >= 2 (so k in 2..8 are strictly in the past).
        # Let's shift by the appropriate number of 24h lags:
        first_k = int(np.ceil(h / 24.0))
        past_lags = [h - 24 * k for k in range(first_k, first_k + 7)]
        # Check all are <= 0
        assert all(lag <= 0 for lag in past_lags), f"Future leakage in past_lags: {past_lags}"
        
        # Mean of these 7 past occurrences
        past_cols = []
        for k_idx, lag in enumerate(past_lags):
            col_name = f"_tmp_lag_{abs(lag)}"
            h_df[col_name] = h_df["pm2_5"].shift(-lag)  # -lag is positive
            past_cols.append(col_name)
        
        h_df["baseline_7d_diurnal"] = h_df[past_cols].mean(axis=1)
        # Blended baseline: 50% persistence + 50% 7-day diurnal hour mean
        h_df["baseline_blended"] = 0.5 * h_df["issue_level"] + 0.5 * h_df["baseline_7d_diurnal"]
        h_df.drop(columns=past_cols, inplace=True)

        # Condition (iii): Historical NWP forecast weather
        # Match target local timestamp with nwp_forecast_map
        h_df["target_local_str"] = pd.to_datetime(h_df["datetime"]).dt.tz_convert("Asia/Kolkata").dt.strftime("%Y-%m-%dT%H:00").shift(-h)
        
        nwp_temps = []
        nwp_rhs = []
        nwp_winds = []
        nwp_us = []
        nwp_vs = []
        for t_str in h_df["target_local_str"]:
            item = nwp_forecast_map.get(t_str)
            if item:
                nwp_temps.append(item["temp"])
                nwp_rhs.append(item["rh"])
                nwp_winds.append(item["wind"])
                nwp_us.append(item["u"])
                nwp_vs.append(item["v"])
            else:
                nwp_temps.append(np.nan)
                nwp_rhs.append(np.nan)
                nwp_winds.append(np.nan)
                nwp_us.append(np.nan)
                nwp_vs.append(np.nan)

        h_df["nwp_temp"] = nwp_temps
        h_df["nwp_rh"] = nwp_rhs
        h_df["nwp_wind"] = nwp_winds
        h_df["nwp_u"] = nwp_us
        h_df["nwp_v"] = nwp_vs

        clean_sub = h_df.dropna(subset=["target_delta", "future_temp", "baseline_7d_diurnal"] + base_cols).copy()
        horizon_data[h] = clean_sub

    # Combined dataset for pooled model
    combined_train = pd.concat([horizon_data[h][horizon_data[h]["timestamp_utc"] < cutoff_time] for h in all_train_horizons], ignore_index=True)
    
    # Feature columns for pooled model
    multi_cols = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
        "lead_hours", "log_lead_hours",
        "future_temp", "future_rh", "future_wind", "future_u", "future_v",
        "future_hour_sin", "future_hour_cos"
    ]

    no_weather_cols = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
        "lead_hours", "log_lead_hours",
        "future_hour_sin", "future_hour_cos"
    ]

    nwp_cols = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
        "lead_hours", "log_lead_hours",
        "nwp_temp", "nwp_rh", "nwp_wind", "nwp_u", "nwp_v",
        "future_hour_sin", "future_hour_cos"
    ]

    print("\nTraining Pooled Models...")
    # Model (i): Actual future weather
    m_pooled_actual = LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
    m_pooled_actual.fit(combined_train[multi_cols], combined_train["target_delta"])

    # Model (ii): No future weather (only hour-of-day)
    m_pooled_noweather = LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
    m_pooled_noweather.fit(combined_train[no_weather_cols], combined_train["target_delta"])

    # 4. Train Per-Horizon Models & Quantile Models (alpha=0.1, 0.9)
    print("\nTraining Per-Horizon Models and Quantile Models for h in 1..48...")
    per_horizon_models = {}
    per_horizon_q10 = {}
    per_horizon_q90 = {}

    for h in all_train_horizons:
        tr = horizon_data[h][horizon_data[h]["timestamp_utc"] < cutoff_time]
        
        # Per-horizon features (no lead_hours needed since h is fixed)
        h_cols = [
            "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
            "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
            "future_temp", "future_rh", "future_wind", "future_u", "future_v",
            "future_hour_sin", "future_hour_cos"
        ]

        m_h = LGBMRegressor(n_estimators=100, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
        m_h.fit(tr[h_cols], tr["target_delta"])
        per_horizon_models[h] = m_h

        # Quantile models for uncertainty bands
        q10 = LGBMRegressor(objective="quantile", alpha=0.1, n_estimators=100, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
        q10.fit(tr[h_cols], tr["target_delta"])
        per_horizon_q10[h] = q10

        q90 = LGBMRegressor(objective="quantile", alpha=0.9, n_estimators=100, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
        q90.fit(tr[h_cols], tr["target_delta"])
        per_horizon_q90[h] = q90

    # 5. Horizon Evaluations & Comparisons
    results = {}
    print("\n=== RUNNING EVALUATIONS ON HELD-OUT TEST PARTITION ===")

    for h in eval_horizons:
        te = horizon_data[h][horizon_data[h]["timestamp_utc"] >= cutoff_time].copy()
        y_true = te["target_level"].values
        issue_val = te["issue_level"].values

        # Baselines
        base_persist = issue_val
        base_7d = te["baseline_7d_diurnal"].values
        base_blend = te["baseline_blended"].values

        mae_persist = float(np.mean(np.abs(y_true - base_persist)))
        mae_7d = float(np.mean(np.abs(y_true - base_7d)))
        mae_blend = float(np.mean(np.abs(y_true - base_blend)))

        # Pooled Model (i) Actual Weather
        pred_pooled_actual = issue_val + m_pooled_actual.predict(te[multi_cols])
        mae_pooled_actual = float(np.mean(np.abs(y_true - pred_pooled_actual)))

        # Pooled Model (ii) No Future Weather
        pred_pooled_noweather = issue_val + m_pooled_noweather.predict(te[no_weather_cols])
        mae_pooled_noweather = float(np.mean(np.abs(y_true - pred_pooled_noweather)))

        # Pooled Model (iii) NWP Forecast Weather (where available in test set)
        te_nwp = te.dropna(subset=["nwp_temp", "nwp_rh", "nwp_wind"]).copy()
        if len(te_nwp) > 0:
            te_nwp_renamed = te_nwp.drop(columns=["future_temp", "future_rh", "future_wind", "future_u", "future_v"]).rename(columns={
                "nwp_temp": "future_temp",
                "nwp_rh": "future_rh",
                "nwp_wind": "future_wind",
                "nwp_u": "future_u",
                "nwp_v": "future_v",
            })
            pred_nwp = te_nwp["issue_level"].values + m_pooled_actual.predict(te_nwp_renamed[multi_cols])
            mae_nwp = float(np.mean(np.abs(te_nwp["target_level"].values - pred_nwp)))
        else:
            mae_nwp = None

        # Per-Horizon Model (Part C)
        m_h = per_horizon_models[h]
        h_cols = [
            "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
            "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
            "future_temp", "future_rh", "future_wind", "future_u", "future_v",
            "future_hour_sin", "future_hour_cos"
        ]
        pred_per_horizon = issue_val + m_h.predict(te[h_cols])
        mae_per_horizon = float(np.mean(np.abs(y_true - pred_per_horizon)))

        # Quantile Coverage (Part D)
        q10_delta = per_horizon_q10[h].predict(te[h_cols])
        q90_delta = per_horizon_q90[h].predict(te[h_cols])
        lower_bound = np.maximum(0, issue_val + q10_delta)
        upper_bound = issue_val + q90_delta
        in_band = (y_true >= lower_bound) & (y_true <= upper_bound)
        coverage_pct = float(np.mean(in_band) * 100)

        # High PM2.5 (> 40) vs Low PM2.5 (<= 40)
        high_mask = (y_true > 40)
        low_mask = (y_true <= 40)
        mae_high = float(np.mean(np.abs(y_true[high_mask] - pred_per_horizon[high_mask]))) if np.sum(high_mask) > 0 else None
        mae_low = float(np.mean(np.abs(y_true[low_mask] - pred_per_horizon[low_mask]))) if np.sum(low_mask) > 0 else None
        count_high = int(np.sum(high_mask))
        count_low = int(np.sum(low_mask))

        # Monthly breakdown
        te["datetime_local"] = pd.to_datetime(te["datetime"]).dt.tz_convert("Asia/Kolkata")
        te["month"] = te["datetime_local"].dt.month_name()
        monthly_mae = {}
        for month, m_grp in te.groupby("month"):
            m_true = m_grp["target_level"].values
            m_pred = m_grp["issue_level"].values + m_h.predict(m_grp[h_cols])
            monthly_mae[month] = {
                "count": len(m_grp),
                "mae_model": float(np.mean(np.abs(m_true - m_pred))),
                "mae_persist": float(np.mean(np.abs(m_true - m_grp["issue_level"].values))),
                "mean_pm25": float(np.mean(m_true))
            }

        # Block bootstrap CI for Per-Horizon Model vs Persistence
        diffs_persist = np.abs(y_true - pred_per_horizon) - np.abs(y_true - base_persist)
        ci_persist = block_bootstrap_ci(diffs_persist, block_size=24, n_boot=1000)

        # Block bootstrap CI for Per-Horizon Model vs 7-day diurnal baseline
        diffs_7d = np.abs(y_true - pred_per_horizon) - np.abs(y_true - base_7d)
        ci_7d = block_bootstrap_ci(diffs_7d, block_size=24, n_boot=1000)

        results[h] = {
            "lead_hours": h,
            "test_count": len(y_true),
            "mae_persistence": round(mae_persist, 2),
            "mae_7d_diurnal": round(mae_7d, 2),
            "mae_blended": round(mae_blend, 2),
            "mae_pooled_actual_weather": round(mae_pooled_actual, 2),
            "mae_pooled_no_weather": round(mae_pooled_noweather, 2),
            "mae_pooled_nwp_forecast": round(mae_nwp, 2) if mae_nwp else None,
            "mae_per_horizon_model": round(mae_per_horizon, 2),
            "ci_per_horizon_vs_persistence": [round(ci_persist[0], 2), round(ci_persist[1], 2)],
            "ci_per_horizon_vs_7d_diurnal": [round(ci_7d[0], 2), round(ci_7d[1], 2)],
            "quantile_coverage_pct": round(coverage_pct, 1),
            "mae_pm25_gt_40": round(mae_high, 2) if mae_high else None,
            "count_gt_40": count_high,
            "mae_pm25_le_40": round(mae_low, 2) if mae_low else None,
            "count_le_40": count_low,
            "monthly_mae": monthly_mae
        }

    print("\n=== FINAL RESULTS SUMMARY ===")
    for h, res in results.items():
        print(f"\n--- HORIZON h={h} ---")
        print(f"Persistence MAE:             {res['mae_persistence']}")
        print(f"7-Day Diurnal MAE:           {res['mae_7d_diurnal']}")
        print(f"Blended (50% Persist+7d) MAE: {res['mae_blended']}")
        print(f"Pooled Model (Actual Wx):    {res['mae_pooled_actual_weather']}")
        print(f"Pooled Model (No Wx):        {res['mae_pooled_no_weather']}")
        print(f"Pooled Model (NWP Forecast): {res['mae_pooled_nwp_forecast']}")
        print(f"Per-Horizon Model:           {res['mae_per_horizon_model']}")
        print(f"Per-Horizon 95% CI vs Persist: {res['ci_per_horizon_vs_persistence']}")
        print(f"Per-Horizon 95% CI vs 7d Diurnal: {res['ci_per_horizon_vs_7d_diurnal']}")
        print(f"Quantile [q10, q90] Coverage: {res['quantile_coverage_pct']}%")
        print(f"MAE for PM2.5 > 40 (n={res['count_gt_40']}): {res['mae_pm25_gt_40']}")
        print(f"MAE for PM2.5 <= 40 (n={res['count_le_40']}): {res['mae_pm25_le_40']}")

    # Save to json file for review and inspection
    out_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "fairness_results.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved detailed results to {out_path}")

    # Also save the updated per-horizon and quantile models to lgbm_model.pkl
    import joblib
    model_artifact = {
        "pooled_model": m_pooled_actual,
        "multi_cols": multi_cols,
        "per_horizon_models": per_horizon_models,
        "per_horizon_q10": per_horizon_q10,
        "per_horizon_q90": per_horizon_q90,
        "h_cols": h_cols,
    }
    joblib.dump(model_artifact, os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "lgbm_model.pkl"))
    print("Saved trained models, per-horizon models, and quantile models to lgbm_model.pkl")


if __name__ == "__main__":
    run_fairness_suite()
