"""
Seasonal Holdout Cross-Validation and Feature Importance Analysis for Mumbai Air Atlas.

Executes:
1. Blocked seasonal cross-validation with 7-day exclusion buffers:
   - Winter 2024-2025 (Nov 2024 - Feb 2025)
   - Winter 2025-2026 (Nov 2025 - Feb 2026)
   - Pre-monsoon 2025 (Mar - May 2025)
   - Monsoon 2025 (Jun - Sep 2025)
   - Oct 2025 (Oct 2025)
2. For each fold and horizon (1, 6, 12, 24, 48):
   - Model MAE, Persistence MAE, Blended Baseline MAE (0.5 y_t + 0.5 y_7d_hour)
   - 24h block-bootstrap 95% CI on (Model Error - Best Baseline Error)
3. Weather importance ablation across horizons:
   (a) Full features
   (b) Lags + hour-of-day only
   (c) Lags only
4. Feature importance by Gain (LightGBM) for 6h and 24h models grouped as:
   - lag
   - hour
   - weather
5. Validation analysis for baseline blend weight.
"""

import os
import sys
import json
import sqlite3
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.ml.features import build_features

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mumbai_air.db")
OUTPUT_JSON = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "seasonal_evaluation_results.json")


def block_bootstrap_ci(diffs: np.ndarray, block_size: int = 24, n_boot: int = 1000, random_state: int = 42) -> tuple[float, float]:
    np.random.seed(random_state)
    n = len(diffs)
    if n == 0:
        return 0.0, 0.0
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


def run_seasonal_and_weather_evaluation():
    print("=== 1. LOADING DATA ARCHIVE ===")
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

    print(f"Total archive records: {len(df)}")
    featured_df, base_cols = build_features(df)
    featured_df["dt"] = pd.to_datetime(featured_df["timestamp_local"])

    eval_horizons = [1, 6, 12, 24, 48]

    # Pre-build dataset per horizon with future shifts and 7-day diurnal baseline
    print("Pre-building feature datasets for horizons 1, 6, 12, 24, 48...")
    horizon_data = {}
    for h in eval_horizons:
        h_df = featured_df.copy()
        h_df["lead_hours"] = h
        h_df["target_level"] = h_df["pm2_5"].shift(-h)
        h_df["issue_level"] = h_df["pm2_5"]
        h_df["target_delta"] = h_df["target_level"] - h_df["issue_level"]

        h_df["future_temp"] = h_df["temperature_2m"].shift(-h)
        h_df["future_rh"] = h_df["relative_humidity_2m"].shift(-h)
        h_df["future_wind"] = h_df["wind_speed_10m"].shift(-h)
        h_df["future_u"] = h_df["wind_u"].shift(-h)
        h_df["future_v"] = h_df["wind_v"].shift(-h)
        h_df["future_hour_sin"] = h_df["hour_sin"].shift(-h)
        h_df["future_hour_cos"] = h_df["hour_cos"].shift(-h)

        # 7-day diurnal baseline strictly before issue time
        first_k = int(np.ceil(h / 24.0))
        past_lags = [h - 24 * k for k in range(first_k, first_k + 7)]
        assert all(lag <= 0 for lag in past_lags), f"Leakage detected: {past_lags}"

        past_cols = []
        for lag in past_lags:
            col_name = f"_tmp_lag_{abs(lag)}"
            h_df[col_name] = h_df["pm2_5"].shift(-lag)
            past_cols.append(col_name)

        h_df["baseline_7d_diurnal"] = h_df[past_cols].mean(axis=1)
        h_df["baseline_blended"] = 0.5 * h_df["issue_level"] + 0.5 * h_df["baseline_7d_diurnal"]
        h_df.drop(columns=past_cols, inplace=True)

        clean_h = h_df.dropna(subset=["target_delta", "future_temp", "baseline_7d_diurnal"] + base_cols).copy()
        horizon_data[h] = clean_h

    # Define the 5 Seasonal Holdouts and 7-day Exclusion Buffers
    folds = [
        {
            "name": "Winter 2024-2025",
            "season_type": "winter",
            "test_start": "2024-11-01 00:00:00",
            "test_end": "2025-02-28 23:59:59",
            "buffer_start": "2024-10-25 00:00:00",
            "buffer_end": "2025-03-07 23:59:59",
        },
        {
            "name": "Winter 2025-2026",
            "season_type": "winter",
            "test_start": "2025-11-01 00:00:00",
            "test_end": "2026-02-28 23:59:59",
            "buffer_start": "2025-10-25 00:00:00",
            "buffer_end": "2026-03-07 23:59:59",
        },
        {
            "name": "Pre-monsoon 2025",
            "season_type": "pre_monsoon",
            "test_start": "2025-03-01 00:00:00",
            "test_end": "2025-05-31 23:59:59",
            "buffer_start": "2025-02-22 00:00:00",
            "buffer_end": "2025-06-07 23:59:59",
        },
        {
            "name": "Monsoon 2025",
            "season_type": "monsoon",
            "test_start": "2025-06-01 00:00:00",
            "test_end": "2025-09-30 23:59:59",
            "buffer_start": "2025-05-25 00:00:00",
            "buffer_end": "2025-10-07 23:59:59",
        },
        {
            "name": "Oct 2025",
            "season_type": "post_monsoon",
            "test_start": "2025-10-01 00:00:00",
            "test_end": "2025-10-31 23:59:59",
            "buffer_start": "2025-09-24 00:00:00",
            "buffer_end": "2025-11-07 23:59:59",
        },
    ]

    feature_cols = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
        "future_temp", "future_rh", "future_wind", "future_u", "future_v",
        "future_hour_sin", "future_hour_cos",
    ]

    no_weather_cols = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
        "future_hour_sin", "future_hour_cos",
    ]

    lags_only_cols = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
    ]

    seasonal_results = {}

    print("\n=== 2. RUNNING SEASONAL HOLDOUT CROSS-VALIDATION ===")
    for fold in folds:
        fold_name = fold["name"]
        print(f"\n--- FOLD: {fold_name} ---")
        print(f"Test window: {fold['test_start']} to {fold['test_end']}")
        print(f"Buffer excluded from training: {fold['buffer_start']} to {fold['buffer_end']}")

        fold_dict = {
            "name": fold_name,
            "season_type": fold["season_type"],
            "test_start": fold["test_start"],
            "test_end": fold["test_end"],
            "horizons": {},
        }

        for h in eval_horizons:
            df_h = horizon_data[h]
            test_mask = (df_h["dt"] >= fold["test_start"]) & (df_h["dt"] <= fold["test_end"])
            train_mask = (df_h["dt"] < fold["buffer_start"]) | (df_h["dt"] > fold["buffer_end"])

            train_df = df_h[train_mask]
            test_df = df_h[test_mask]

            # Fit Model
            m = LGBMRegressor(
                n_estimators=100,
                learning_rate=0.03,
                num_leaves=31,
                random_state=42,
                verbosity=-1,
                importance_type="gain",
            )
            m.fit(train_df[feature_cols], train_df["target_delta"])

            # Evaluate
            y_true = test_df["target_level"].values
            issue_val = test_df["issue_level"].values
            y_pred = issue_val + m.predict(test_df[feature_cols])

            mae_model = float(np.mean(np.abs(y_true - y_pred)))
            mae_persist = float(np.mean(np.abs(y_true - issue_val)))
            mae_blend = float(np.mean(np.abs(y_true - test_df["baseline_blended"].values)))

            # Identify best baseline
            best_base_name = "persistence" if mae_persist <= mae_blend else "blended"
            best_base_vals = issue_val if best_base_name == "persistence" else test_df["baseline_blended"].values
            best_base_mae = mae_persist if best_base_name == "persistence" else mae_blend

            # Residual differences: Model Error - Best Baseline Error
            model_errors = np.abs(y_true - y_pred)
            base_errors = np.abs(y_true - best_base_vals)
            diffs = model_errors - base_errors  # negative means model wins

            ci_low, ci_high = block_bootstrap_ci(diffs, block_size=24, n_boot=1000)

            delta_vs_best = mae_model - best_base_mae
            skill_pct = (best_base_mae - mae_model) / best_base_mae * 100.0

            fold_dict["horizons"][str(h)] = {
                "lead_hours": h,
                "test_hours": int(len(test_df)),
                "mean_pm25": float(y_true.mean()),
                "mae_model": round(mae_model, 2),
                "mae_persistence": round(mae_persist, 2),
                "mae_blended": round(mae_blend, 2),
                "best_baseline": best_base_name,
                "best_baseline_mae": round(best_base_mae, 2),
                "delta_vs_best_baseline": round(delta_vs_best, 2),
                "skill_pct_vs_best_baseline": round(skill_pct, 1),
                "ci_95_model_minus_best_baseline": [round(ci_low, 2), round(ci_high, 2)],
                "winner": "model" if ci_high < 0 else "baseline" if ci_low > 0 else "statistically_tied",
            }

            print(
                f"  h={h:2d}h | Test N={len(test_df):4d} (Mean PM2.5: {y_true.mean():.1f}) | "
                f"Model: {mae_model:.2f} | Persist: {mae_persist:.2f} | Blend: {mae_blend:.2f} | "
                f"Best: {best_base_name} ({best_base_mae:.2f}) | "
                f"Delta: {delta_vs_best:+.2f} ({skill_pct:+.1f}%) | "
                f"95% CI: [{ci_low:+.2f}, {ci_high:+.2f}] | {fold_dict['horizons'][str(h)]['winner'].upper()}"
            )

        seasonal_results[fold_name] = fold_dict

    # === 3. DOES WEATHER MATTER ABLATION ===
    print("\n=== 3. RUNNING WEATHER ABLATION (Full vs No-Weather vs Lags-Only) ===")
    weather_ablation_results = {}
    
    # We will compute ablation across the entire dataset with standard 5-fold seasonal holdout averaging
    for h in eval_horizons:
        full_maes = []
        no_weather_maes = []
        lags_only_maes = []

        for fold in folds:
            df_h = horizon_data[h]
            test_mask = (df_h["dt"] >= fold["test_start"]) & (df_h["dt"] <= fold["test_end"])
            train_mask = (df_h["dt"] < fold["buffer_start"]) | (df_h["dt"] > fold["buffer_end"])

            train_df = df_h[train_mask]
            test_df = df_h[test_mask]
            y_true = test_df["target_level"].values
            issue_val = test_df["issue_level"].values

            # (a) Full features
            m_full = LGBMRegressor(n_estimators=100, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
            m_full.fit(train_df[feature_cols], train_df["target_delta"])
            pred_full = issue_val + m_full.predict(test_df[feature_cols])
            full_maes.append(float(np.mean(np.abs(y_true - pred_full))))

            # (b) Lags + hour-of-day only
            m_noweather = LGBMRegressor(n_estimators=100, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
            m_noweather.fit(train_df[no_weather_cols], train_df["target_delta"])
            pred_noweather = issue_val + m_noweather.predict(test_df[no_weather_cols])
            no_weather_maes.append(float(np.mean(np.abs(y_true - pred_noweather))))

            # (c) Lags only
            m_lags = LGBMRegressor(n_estimators=100, learning_rate=0.03, num_leaves=31, random_state=42, verbosity=-1)
            m_lags.fit(train_df[lags_only_cols], train_df["target_delta"])
            pred_lags = issue_val + m_lags.predict(test_df[lags_only_cols])
            lags_only_maes.append(float(np.mean(np.abs(y_true - pred_lags))))

        avg_full = float(np.mean(full_maes))
        avg_noweather = float(np.mean(no_weather_maes))
        avg_lagsonly = float(np.mean(lags_only_maes))

        weather_ablation_results[str(h)] = {
            "lead_hours": h,
            "mae_full_features": round(avg_full, 2),
            "mae_lags_plus_hour": round(avg_noweather, 2),
            "mae_lags_only": round(avg_lagsonly, 2),
            "gain_from_weather": round(avg_noweather - avg_full, 2),
            "gain_from_hour": round(avg_lagsonly - avg_noweather, 2),
        }

        print(
            f"  h={h:2d}h | (a) Full Features: {avg_full:.2f} | "
            f"(b) Lags + Hour: {avg_noweather:.2f} | "
            f"(c) Lags Only: {avg_lagsonly:.2f} | "
            f"Weather Gain: {avg_noweather - avg_full:+.2f} ug/m3 | "
            f"Hour Gain: {avg_lagsonly - avg_noweather:+.2f} ug/m3"
        )

    # === 4. FEATURE IMPORTANCE BY GAIN (6h and 24h models) ===
    print("\n=== 4. LIGHTGBM GAIN IMPORTANCE (6h and 24h models) ===")
    importance_results = {}
    
    lag_feats = [
        "pm2_5_lag_1", "pm2_5_lag_2", "pm2_5_lag_3", "pm2_5_lag_6", "pm2_5_lag_24",
        "pm2_5_roll_mean_6", "pm2_5_roll_std_6", "pm2_5_roll_mean_24",
    ]
    hour_feats = ["future_hour_sin", "future_hour_cos"]
    weather_feats = ["future_temp", "future_rh", "future_wind", "future_u", "future_v"]

    for h in [6, 24]:
        df_h = horizon_data[h]
        # Train on full clean set to measure overall model split gain
        m = LGBMRegressor(
            n_estimators=100,
            learning_rate=0.03,
            num_leaves=31,
            random_state=42,
            verbosity=-1,
            importance_type="gain",
        )
        m.fit(df_h[feature_cols], df_h["target_delta"])
        
        gains = m.booster_.feature_importance(importance_type="gain")
        feat_gain_map = dict(zip(feature_cols, gains))

        total_gain = float(np.sum(gains))
        lag_gain = float(sum(feat_gain_map[f] for f in lag_feats))
        hour_gain = float(sum(feat_gain_map[f] for f in hour_feats))
        weather_gain = float(sum(feat_gain_map[f] for f in weather_feats))

        importance_results[str(h)] = {
            "lead_hours": h,
            "total_gain": round(total_gain, 1),
            "groups": {
                "lag": {
                    "total_gain": round(lag_gain, 1),
                    "pct_share": round(lag_gain / total_gain * 100.0, 1),
                },
                "hour": {
                    "total_gain": round(hour_gain, 1),
                    "pct_share": round(hour_gain / total_gain * 100.0, 1),
                },
                "weather": {
                    "total_gain": round(weather_gain, 1),
                    "pct_share": round(weather_gain / total_gain * 100.0, 1),
                },
            },
            "individual_features": {
                f: {
                    "gain": round(float(feat_gain_map[f]), 1),
                    "pct_share": round(float(feat_gain_map[f]) / total_gain * 100.0, 1),
                }
                for f in sorted(feat_gain_map, key=lambda x: feat_gain_map[x], reverse=True)
            },
        }

        print(f"\nModel {h}-hour Horizon Total Gain: {total_gain:.1f}")
        print(f"  - Lag Group:     {lag_gain:10.1f} ({lag_gain / total_gain * 100.0:.1f}%)")
        print(f"  - Hour Group:    {hour_gain:10.1f} ({hour_gain / total_gain * 100.0:.1f}%)")
        print(f"  - Weather Group: {weather_gain:10.1f} ({weather_gain / total_gain * 100.0:.1f}%)")
        print("  Top individual features by gain:")
        for f in sorted(feat_gain_map, key=lambda x: feat_gain_map[x], reverse=True)[:6]:
            print(f"    {f:20s}: {feat_gain_map[f]:8.1f} ({feat_gain_map[f] / total_gain * 100.0:.1f}%)")

    # === 5. VALIDATION OF BLEND WEIGHT ===
    print("\n=== 5. VALIDATION ANALYSIS OF BASELINE BLEND WEIGHT (alpha * y_t + (1 - alpha) * y_7d_hour) ===")
    blend_validation_results = {}
    alphas = [0.0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0]

    for h in eval_horizons:
        df_h = horizon_data[h]
        # Evaluate on the pre-monsoon fold as a distinct validation partition
        val_mask = (df_h["dt"] >= "2025-03-01 00:00:00") & (df_h["dt"] <= "2025-05-31 23:59:59")
        val_df = df_h[val_mask]
        y_true = val_df["target_level"].values
        yt = val_df["issue_level"].values
        y7d = val_df["baseline_7d_diurnal"].values

        best_alpha = 0.5
        min_mae = 999.0
        alpha_maes = {}
        for a in alphas:
            blend_pred = a * yt + (1.0 - a) * y7d
            mae = float(np.mean(np.abs(y_true - blend_pred)))
            alpha_maes[f"{a:.1f}"] = round(mae, 2)
            if mae < min_mae:
                min_mae = mae
                best_alpha = a

        blend_validation_results[str(h)] = {
            "lead_hours": h,
            "alpha_maes": alpha_maes,
            "best_alpha_validation": best_alpha,
            "best_val_mae": round(min_mae, 2),
            "heuristic_50_50_mae": alpha_maes["0.5"],
            "difference_vs_50_50": round(min_mae - alpha_maes["0.5"], 2),
        }
        print(f"  h={h:2d}h | Optimal Val Alpha: {best_alpha:.1f} (MAE {min_mae:.2f}) vs 0.5 (MAE {alpha_maes['0.5']:.2f})")

    # Combine everything into output payload
    combined_payload = {
        "seasonal_holdouts": seasonal_results,
        "weather_ablation": weather_ablation_results,
        "gain_importance": importance_results,
        "blend_weight_validation": blend_validation_results,
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(combined_payload, f, indent=2)

    print(f"\nAll results saved to {OUTPUT_JSON}")
    return combined_payload


if __name__ == "__main__":
    run_seasonal_and_weather_evaluation()
