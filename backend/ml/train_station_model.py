"""
train_station_model.py
Upgraded Station-Target LightGBM Pipeline & Evaluation.
Includes:
1. Fixed Diurnal Climatology Blend Baseline (by IST clock hour 0..23, fitting alpha on training window).
2. Whole Calendar-Day Block Bootstrap (all stations in a calendar day resampled together, B=500).
3. Clean Spatial Holdout: trained ONLY on prior data on non-held-out sites, tested on held-out site groups (bkc, worli, deonar).
4. CAMS(t+h) Feature Ablation: models trained with vs without cams_future.
5. Strict forward-chaining across chronological folds with mean and top-decile MAE, and quantile coverage (q10/q90).
"""

import os
import sys
import json
import sqlite3
import numpy as np
import pandas as pd
import lightgbm as lgb
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(PROJECT_ROOT, "backend", "data", "mumbai_air.db")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "backend", "data", "station_model_evaluation.json")

# 24 Candidate locations mapped to site groups
SITE_GROUPS = {
    "11606": "borivali",
    "11611": "malad",
    "3409479": "malad",
    "3409469": "thane",
    "3409472": "thane",
    "3409477": "vashi",
    "3409487": "sanpada",
    "3409471": "kalamboli",
    "6943": "mahape",
    "3409514": "ghatkopar",
    "3409511": "shivaji_nagar",
    "3409483": "chembur",
    "3409510": "byculla",
    "3409482": "bkc",
    "12024": "andheri",
    "3409478": "bhayandar",
    "6959": "worli",
    "3409323": "worli",
    "3409329": "deonar",
    "3409512": "kandivali",
    "12040": "mulund",
    "6945": "kurla",
    "6948": "airport",
    "6967": "sion",
}

HORIZONS = [1, 6, 12, 24, 48]

def load_data():
    conn = sqlite3.connect(DB_PATH)
    print("Loading CAMS hourly records...", flush=True)
    df_cams = pd.read_sql_query("""
        SELECT timestamp_utc, timestamp_local, pm2_5 AS cams_pm25,
               temperature_2m, relative_humidity_2m, wind_speed_10m, wind_direction_10m
        FROM hourly_records
        WHERE pm2_5 IS NOT NULL
    """, conn)
    df_cams['utc_dt'] = pd.to_datetime(df_cams['timestamp_utc'])
    df_cams['join_key'] = df_cams['utc_dt'].dt.strftime('%Y-%m-%d %H:%M:%S')
    cams_indexed = df_cams.set_index('join_key')

    wd_rad = np.radians(cams_indexed['wind_direction_10m'].fillna(0).values)
    ws = cams_indexed['wind_speed_10m'].fillna(0).values
    cams_indexed['cams_u'] = -ws * np.sin(wd_rad)
    cams_indexed['cams_v'] = -ws * np.cos(wd_rad)

    print("Loading station records for 24 candidate stations...", flush=True)
    st_dfs = {}
    for sid, sgroup in SITE_GROUPS.items():
        df_s = pd.read_sql_query("""
            SELECT timestamp_utc, timestamp_local, pm2_5 AS station_pm25
            FROM station_hourly
            WHERE station_id = ? AND pm2_5 IS NOT NULL AND timestamp_utc >= '2025-02-01'
            ORDER BY timestamp_utc ASC
        """, conn, params=(sid,))
        
        if len(df_s) < 10000:
            continue
            
        df_s['utc_to'] = pd.to_datetime(df_s['timestamp_utc'])
        # datetimeFrom = datetimeTo - 1 hour (align hour-beginning with CAMS)
        df_s['utc_from'] = df_s['utc_to'] - pd.Timedelta(hours=1)
        df_s['join_key'] = df_s['utc_from'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df_s = df_s.drop_duplicates(subset=['join_key']).set_index('join_key')
        st_dfs[sid] = df_s

    conn.close()
    print(f"Loaded {len(st_dfs)} stations meeting criteria.", flush=True)
    return cams_indexed, st_dfs

def build_features(cams_df, st_dfs):
    print("Building multi-station feature matrices...", flush=True)
    all_rows = []

    for sid, s_df in st_dfs.items():
        sgroup = SITE_GROUPS[sid]
        merged = s_df.join(cams_df[['cams_pm25', 'temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'cams_u', 'cams_v']], how='inner')
        merged['dt'] = pd.to_datetime(merged.index)
        merged = merged.sort_values('dt').set_index('dt')
        
        full_idx = pd.date_range(merged.index.min(), merged.index.max(), freq='1h')
        merged = merged.reindex(full_idx)
        
        s_vals = merged['station_pm25']
        c_vals = merged['cams_pm25']
        
        l1 = s_vals
        l2 = s_vals.shift(1)
        l3 = s_vals.shift(2)
        l6 = s_vals.shift(5)
        l24 = s_vals.shift(23)
        
        roll_mean_6 = s_vals.rolling(6, min_periods=1).mean().fillna(l1)
        roll_std_6 = s_vals.rolling(6, min_periods=1).std().fillna(0)
        roll_mean_24 = s_vals.rolling(24, min_periods=1).mean().fillna(l1)
        roll_std_24 = s_vals.rolling(24, min_periods=1).std().fillna(0)
        
        res = s_vals - c_vals
        res_mean_6 = res.rolling(6, min_periods=1).mean().fillna(0)
        res_mean_24 = res.rolling(24, min_periods=1).mean().fillna(0)
        
        base_df = pd.DataFrame({
            'station_id': sid,
            'site_group': sgroup,
            'lag_1': l1,
            'lag_2': l2,
            'lag_3': l3,
            'lag_6': l6,
            'lag_24': l24,
            'roll_mean_6': roll_mean_6,
            'roll_std_6': roll_std_6,
            'roll_mean_24': roll_mean_24,
            'roll_std_24': roll_std_24,
            'cams_issue': c_vals,
            'res_issue': res,
            'res_mean_6': res_mean_6,
            'res_mean_24': res_mean_24,
            'temp_issue': merged['temperature_2m'],
            'rh_issue': merged['relative_humidity_2m'],
            'ws_issue': merged['wind_speed_10m'],
            'u_issue': merged['cams_u'],
            'v_issue': merged['cams_v'],
        }, index=merged.index)
        
        for h in HORIZONS:
            fut_s = s_vals.shift(-h)
            fut_c = c_vals.shift(-h)
            fut_temp = merged['temperature_2m'].shift(-h)
            fut_rh = merged['relative_humidity_2m'].shift(-h)
            fut_ws = merged['wind_speed_10m'].shift(-h)
            fut_u = merged['cams_u'].shift(-h)
            fut_v = merged['cams_v'].shift(-h)
            
            fut_dt = base_df.index + pd.Timedelta(hours=h)
            # IST hour (0..23) = UTC + 5.5 hours
            ist_hours = (fut_dt + pd.Timedelta(hours=5, minutes=30)).hour
            sin_h = np.sin(2 * np.pi * ist_hours / 24.0)
            cos_h = np.cos(2 * np.pi * ist_hours / 24.0)
            dow = (fut_dt + pd.Timedelta(hours=5, minutes=30)).dayofweek
            
            persist_val = l1
            cams_minus_bias = fut_c + res_mean_24
            
            h_df = pd.DataFrame({
                'issue_time': base_df.index,
                'target_time': fut_dt,
                'target_hour_ist': ist_hours,
                'station_id': sid,
                'site_group': sgroup,
                'horizon': h,
                'lag_1': l1,
                'lag_2': l2,
                'lag_3': l3,
                'lag_6': l6,
                'lag_24': l24,
                'roll_mean_6': roll_mean_6,
                'roll_std_6': roll_std_6,
                'roll_mean_24': roll_mean_24,
                'roll_std_24': roll_std_24,
                'cams_issue': c_vals,
                'res_issue': res,
                'res_mean_6': res_mean_6,
                'res_mean_24': res_mean_24,
                'cams_future': fut_c,
                'future_temp': fut_temp,
                'future_rh': fut_rh,
                'future_ws': fut_ws,
                'future_u': fut_u,
                'future_v': fut_v,
                'sin_hour': sin_h,
                'cos_hour': cos_h,
                'dayofweek': dow,
                'persist_val': persist_val,
                'cams_minus_bias_24': cams_minus_bias,
                'target_actual': fut_s,
                'target_delta': fut_s - l1,
            })
            
            valid = h_df.dropna(subset=[
                'lag_1', 'lag_2', 'lag_3', 'lag_6', 'lag_24',
                'cams_issue', 'res_issue', 'cams_future', 'future_temp',
                'future_rh', 'future_ws', 'future_u', 'future_v',
                'target_actual', 'target_delta', 'cams_minus_bias_24'
            ])
            all_rows.append(valid)
            
    df_all = pd.concat(all_rows, ignore_index=True)
    df_all['site_group'] = df_all['site_group'].astype('category')
    print(f"Total valid feature rows generated: {len(df_all)}", flush=True)
    return df_all

def fit_diurnal_blend(s_train, target_train, hours_ist):
    """
    Fits diurnal climatology by IST clock hour and optimal blend weight alpha.
    """
    df = pd.DataFrame({'s': s_train, 'tgt': target_train, 'hr': hours_ist})
    climatology = df.groupby('hr')['tgt'].mean().to_dict()
    overall_mean = float(df['tgt'].mean())
    mu_target = df['hr'].map(lambda h: climatology.get(h, overall_mean)).values
    
    y = df['tgt'].values - mu_target
    x = df['s'].values - mu_target
    denom = np.sum(x ** 2)
    alpha = float(np.clip(np.sum(x * y) / denom if denom > 0 else 0.5, 0.0, 1.0))
    return climatology, overall_mean, alpha

def predict_diurnal_blend(s_test, hours_ist, climatology, overall_mean, alpha):
    mu_test = np.array([climatology.get(h, overall_mean) for h in hours_ist])
    pred = alpha * s_test + (1.0 - alpha) * mu_test
    return np.maximum(3.0, pred)

def calendar_day_bootstrap_ci(actual, pred_model, pred_base, target_times, b=500):
    """
    Computes 95% CI on (MAE_model - MAE_base) resampling WHOLE calendar days.
    All stations on the same calendar day are resampled together.
    """
    df_eval = pd.DataFrame({
        'cal_day': target_times.dt.date,
        'err_m': np.abs(pred_model - actual),
        'err_b': np.abs(pred_base - actual),
    })
    
    days = df_eval['cal_day'].unique()
    n_days = len(days)
    if n_days < 5:
        diff = float(np.mean(df_eval['err_m'] - df_eval['err_b']))
        return diff, diff, diff

    day_dict = {d: g[['err_m', 'err_b']].values for d, g in df_eval.groupby('cal_day')}
    day_keys = np.array(list(day_dict.keys()))
    
    diffs = []
    np.random.seed(42)
    for _ in range(b):
        sampled_days = np.random.choice(day_keys, size=n_days, replace=True)
        all_m = []
        all_b = []
        for d in sampled_days:
            arr = day_dict[d]
            all_m.append(arr[:, 0])
            all_b.append(arr[:, 1])
        cat_m = np.concatenate(all_m)
        cat_b = np.concatenate(all_b)
        diffs.append(float(np.mean(cat_m) - np.mean(cat_b)))
        
    ci_low = float(np.percentile(diffs, 2.5))
    ci_high = float(np.percentile(diffs, 97.5))
    mean_diff = float(np.mean(diffs))
    return mean_diff, ci_low, ci_high

def run_evaluation(df_all):
    full_feature_names = [
        'site_group',
        'lag_1', 'lag_2', 'lag_3', 'lag_6', 'lag_24',
        'roll_mean_6', 'roll_std_6', 'roll_mean_24', 'roll_std_24',
        'cams_issue', 'res_issue', 'res_mean_6', 'res_mean_24',
        'cams_future', 'future_temp', 'future_rh', 'future_ws', 'future_u', 'future_v',
        'sin_hour', 'cos_hour', 'dayofweek'
    ]
    
    # Ablated feature set: WITHOUT cams_future
    ablated_feature_names = [f for f in full_feature_names if f != 'cams_future']

    results = {
        "forward_chaining": {},
        "cams_ablation": {},
        "spatial_holdout": {},
    }

    time_folds = [
        ("Fold 1: Post-Monsoon (Oct-Nov 2025)", "2025-10-01", "2025-11-30"),
        ("Fold 2: Winter (Dec 2025-Feb 2026)", "2025-12-01", "2026-02-28"),
        ("Fold 3: Pre-Monsoon (Mar-May 2026)", "2026-03-01", "2026-05-31"),
        ("Fold 4: Monsoon (Jun-Sep 2026)", "2026-06-01", "2026-09-30"),
    ]

    print("\n" + "=" * 80, flush=True)
    print("1. FORWARD-CHAINING TIME EVALUATION (FIXED BLEND & CALENDAR-DAY BOOTSTRAP)", flush=True)
    print("=" * 80, flush=True)

    lgb_params = {
        'objective': 'regression_l1',
        'metric': 'mae',
        'learning_rate': 0.05,
        'num_leaves': 31,
        'min_child_samples': 50,
        'n_estimators': 150,
        'n_jobs': -1,
        'verbose': -1,
        'random_state': 42
    }

    for fold_name, test_start, test_end in time_folds:
        print(f"\n--- {fold_name} ---", flush=True)
        results["forward_chaining"][fold_name] = {}
        results["cams_ablation"][fold_name] = {}
        
        train_mask = df_all['target_time'] < test_start
        test_mask = (df_all['target_time'] >= test_start) & (df_all['target_time'] <= test_end)
        
        df_tr_full = df_all[train_mask]
        df_te_full = df_all[test_mask]
        
        if len(df_te_full) == 0 or len(df_tr_full) == 0:
            continue

        for h in HORIZONS:
            df_tr = df_tr_full[df_tr_full['horizon'] == h]
            df_te = df_te_full[df_te_full['horizon'] == h]
            
            s_tr = df_tr['lag_1'].values
            tgt_tr = df_tr['target_actual'].values
            hr_tr = df_tr['target_hour_ist'].values
            
            s_te = df_te['lag_1'].values
            tgt_te = df_te['target_actual'].values
            hr_te = df_te['target_hour_ist'].values
            c_te_th = df_te['cams_future'].values
            
            # 1. Baselines
            # Persistence: s_t
            persist_pred = s_te
            # Diurnal Blend: alpha * s_t + (1 - alpha) * climatology(hour_ist)
            clim, mean_val, alpha = fit_diurnal_blend(s_tr, tgt_tr, hr_tr)
            blend_pred = predict_diurnal_blend(s_te, hr_te, clim, mean_val, alpha)
            # Raw CAMS: c_{t+h}
            raw_cams_pred = np.maximum(3.0, c_te_th)
            # CAMS + Trailing 24h Debiasing: c_{t+h} + res_mean_24
            cams_bias_pred = np.maximum(3.0, df_te['cams_minus_bias_24'].values)

            # 2. Train Full Station-Target Model (with cams_future)
            X_tr = df_tr[full_feature_names]
            y_tr = df_tr['target_delta']
            X_te = df_te[full_feature_names]
            
            model = lgb.LGBMRegressor(**lgb_params)
            model.fit(X_tr, y_tr)
            model_pred = np.maximum(3.0, s_te + model.predict(X_te))

            # 3. Train Ablated Model (WITHOUT cams_future)
            X_tr_abl = df_tr[ablated_feature_names]
            X_te_abl = df_te[ablated_feature_names]
            model_abl = lgb.LGBMRegressor(**lgb_params)
            model_abl.fit(X_tr_abl, y_tr)
            model_abl_pred = np.maximum(3.0, s_te + model_abl.predict(X_te_abl))

            # 4. Train Quantiles (q10, q90)
            q10_m = lgb.LGBMRegressor(objective='quantile', alpha=0.10, learning_rate=0.05, num_leaves=31, n_estimators=100, n_jobs=-1, verbose=-1, random_state=42)
            q10_m.fit(X_tr, y_tr)
            q10_pred = np.maximum(3.0, s_te + q10_m.predict(X_te))

            q90_m = lgb.LGBMRegressor(objective='quantile', alpha=0.90, learning_rate=0.05, num_leaves=31, n_estimators=100, n_jobs=-1, verbose=-1, random_state=42)
            q90_m.fit(X_tr, y_tr)
            q90_pred = np.maximum(3.0, s_te + q90_m.predict(X_te))

            # Evaluate Metrics
            mae_m = float(np.mean(np.abs(model_pred - tgt_te)))
            mae_abl = float(np.mean(np.abs(model_abl_pred - tgt_te)))
            mae_p = float(np.mean(np.abs(persist_pred - tgt_te)))
            mae_b = float(np.mean(np.abs(blend_pred - tgt_te)))
            mae_c = float(np.mean(np.abs(raw_cams_pred - tgt_te)))
            mae_cb = float(np.mean(np.abs(cams_bias_pred - tgt_te)))
            
            cov_overall = float(np.mean((tgt_te >= q10_pred) & (tgt_te <= q90_pred))) * 100.0

            # Top decile
            q90_th = float(np.percentile(tgt_te, 90))
            top_mask = tgt_te >= q90_th
            
            top_mae_m = float(np.mean(np.abs(model_pred[top_mask] - tgt_te[top_mask])))
            top_mae_abl = float(np.mean(np.abs(model_abl_pred[top_mask] - tgt_te[top_mask])))
            top_mae_p = float(np.mean(np.abs(persist_pred[top_mask] - tgt_te[top_mask])))
            top_mae_b = float(np.mean(np.abs(blend_pred[top_mask] - tgt_te[top_mask])))
            top_mae_c = float(np.mean(np.abs(raw_cams_pred[top_mask] - tgt_te[top_mask])))
            top_mae_cb = float(np.mean(np.abs(cams_bias_pred[top_mask] - tgt_te[top_mask])))
            top_cov = float(np.mean((tgt_te[top_mask] >= q10_pred[top_mask]) & (tgt_te[top_mask] <= q90_pred[top_mask]))) * 100.0

            # Whole Calendar Day Bootstrap CI against best baseline
            base_dict = {
                'persistence': (mae_p, persist_pred),
                'blend': (mae_b, blend_pred),
                'cams_bias': (mae_cb, cams_bias_pred)
            }
            best_base_name = min(base_dict, key=lambda k: base_dict[k][0])
            best_base_mae, best_base_pred = base_dict[best_base_name]

            diff_m, ci_l, ci_h = calendar_day_bootstrap_ci(
                tgt_te, model_pred, best_base_pred, df_te['target_time'], b=500
            )

            results["forward_chaining"][fold_name][f"h_{h}"] = {
                "n_samples": int(len(df_te)),
                "alpha_blend": round(alpha, 4),
                "mae_model": round(mae_m, 2),
                "mae_persistence": round(mae_p, 2),
                "mae_blend": round(mae_b, 2),
                "mae_raw_cams": round(mae_c, 2),
                "mae_cams_bias": round(mae_cb, 2),
                "best_baseline": best_base_name,
                "diff_vs_best_baseline": round(diff_m, 2),
                "ci_95_diff": [round(ci_l, 2), round(ci_h, 2)],
                "coverage_overall_pct": round(cov_overall, 1),
                "top_decile_threshold": round(q90_th, 1),
                "top_decile_n": int(top_mask.sum()),
                "top_decile_mae_model": round(top_mae_m, 2),
                "top_decile_mae_persistence": round(top_mae_p, 2),
                "top_decile_mae_blend": round(top_mae_b, 2),
                "top_decile_mae_raw_cams": round(top_mae_c, 2),
                "top_decile_mae_cams_bias": round(top_mae_cb, 2),
                "top_decile_coverage_pct": round(top_cov, 1),
            }

            results["cams_ablation"][fold_name][f"h_{h}"] = {
                "mae_with_cams_future": round(mae_m, 2),
                "mae_without_cams_future": round(mae_abl, 2),
                "delta_mae_ablation": round(mae_abl - mae_m, 2),
                "top_decile_mae_with": round(top_mae_m, 2),
                "top_decile_mae_without": round(top_mae_abl, 2),
            }

            print(f"  h={h:02d}h: Model={mae_m:.2f} | Persist={mae_p:.2f} | Blend={mae_b:.2f} (a={alpha:.2f}) | CAMS+Bias={mae_cb:.2f} | Raw CAMS={mae_c:.2f} | Diff={diff_m:+.2f} [{ci_l:+.2f}, {ci_h:+.2f}] | Ablation={mae_abl:.2f} (D={mae_abl-mae_m:+.2f})", flush=True)

    print("\n" + "=" * 80, flush=True)
    print("2. CLEAN SPATIAL HOLDOUT (TRAINED ONLY PRIOR TO TEST WINDOW)", flush=True)
    print("=" * 80, flush=True)

    # Clean spatial split:
    # Held out sites: bkc, worli, deonar
    # Training window: Feb 18, 2025 to May 31, 2026 on OTHER 20 sites.
    # Testing window: Jun 1, 2026 to Sep 30, 2026 on HELD-OUT sites ONLY.
    held_out_sites = ['bkc', 'worli', 'deonar']
    sp_split_date = "2026-06-01"

    tr_sp_mask = (~df_all['site_group'].isin(held_out_sites)) & (df_all['target_time'] < sp_split_date)
    te_sp_mask = (df_all['site_group'].isin(held_out_sites)) & (df_all['target_time'] >= sp_split_date)

    df_sp_tr_full = df_all[tr_sp_mask]
    df_sp_te_full = df_all[te_sp_mask]
    
    print(f"Spatial Holdout: train={len(df_sp_tr_full)} rows (< {sp_split_date}, non-heldout sites), test={len(df_sp_te_full)} rows (>= {sp_split_date}, {held_out_sites})", flush=True)

    for h in HORIZONS:
        df_tr = df_sp_tr_full[df_sp_tr_full['horizon'] == h]
        df_te = df_sp_te_full[df_sp_te_full['horizon'] == h]

        s_tr = df_tr['lag_1'].values
        tgt_tr = df_tr['target_actual'].values
        hr_tr = df_tr['target_hour_ist'].values

        s_te = df_te['lag_1'].values
        tgt_te = df_te['target_actual'].values
        hr_te = df_te['target_hour_ist'].values
        c_te_th = df_te['cams_future'].values

        persist_pred = s_te
        clim, mean_val, alpha = fit_diurnal_blend(s_tr, tgt_tr, hr_tr)
        blend_pred = predict_diurnal_blend(s_te, hr_te, clim, mean_val, alpha)
        raw_cams_pred = np.maximum(3.0, c_te_th)
        cams_bias_pred = np.maximum(3.0, df_te['cams_minus_bias_24'].values)

        X_tr = df_tr[full_feature_names]
        y_tr = df_tr['target_delta']
        X_te = df_te[full_feature_names]

        model = lgb.LGBMRegressor(**lgb_params)
        model.fit(X_tr, y_tr)
        model_pred = np.maximum(3.0, s_te + model.predict(X_te))

        X_tr_abl = df_tr[ablated_feature_names]
        X_te_abl = df_te[ablated_feature_names]
        model_abl = lgb.LGBMRegressor(**lgb_params)
        model_abl.fit(X_tr_abl, y_tr)
        model_abl_pred = np.maximum(3.0, s_te + model_abl.predict(X_te_abl))

        q10_m = lgb.LGBMRegressor(objective='quantile', alpha=0.10, learning_rate=0.05, num_leaves=31, n_estimators=100, n_jobs=-1, verbose=-1, random_state=42)
        q10_m.fit(X_tr, y_tr)
        q10_pred = np.maximum(3.0, s_te + q10_m.predict(X_te))

        q90_m = lgb.LGBMRegressor(objective='quantile', alpha=0.90, learning_rate=0.05, num_leaves=31, n_estimators=100, n_jobs=-1, verbose=-1, random_state=42)
        q90_m.fit(X_tr, y_tr)
        q90_pred = np.maximum(3.0, s_te + q90_m.predict(X_te))

        mae_m = float(np.mean(np.abs(model_pred - tgt_te)))
        mae_abl = float(np.mean(np.abs(model_abl_pred - tgt_te)))
        mae_p = float(np.mean(np.abs(persist_pred - tgt_te)))
        mae_b = float(np.mean(np.abs(blend_pred - tgt_te)))
        mae_c = float(np.mean(np.abs(raw_cams_pred - tgt_te)))
        mae_cb = float(np.mean(np.abs(cams_bias_pred - tgt_te)))
        cov_overall = float(np.mean((tgt_te >= q10_pred) & (tgt_te <= q90_pred))) * 100.0

        q90_th = float(np.percentile(tgt_te, 90))
        top_mask = tgt_te >= q90_th
        top_mae_m = float(np.mean(np.abs(model_pred[top_mask] - tgt_te[top_mask])))
        top_mae_abl = float(np.mean(np.abs(model_abl_pred[top_mask] - tgt_te[top_mask])))
        top_mae_p = float(np.mean(np.abs(persist_pred[top_mask] - tgt_te[top_mask])))
        top_mae_b = float(np.mean(np.abs(blend_pred[top_mask] - tgt_te[top_mask])))
        top_mae_c = float(np.mean(np.abs(raw_cams_pred[top_mask] - tgt_te[top_mask])))
        top_mae_cb = float(np.mean(np.abs(cams_bias_pred[top_mask] - tgt_te[top_mask])))
        top_cov = float(np.mean((tgt_te[top_mask] >= q10_pred[top_mask]) & (tgt_te[top_mask] <= q90_pred[top_mask]))) * 100.0

        base_dict = {
            'persistence': (mae_p, persist_pred),
            'blend': (mae_b, blend_pred),
            'cams_bias': (mae_cb, cams_bias_pred)
        }
        best_base_name = min(base_dict, key=lambda k: base_dict[k][0])
        best_base_mae, best_base_pred = base_dict[best_base_name]

        diff_m, ci_l, ci_h = calendar_day_bootstrap_ci(
            tgt_te, model_pred, best_base_pred, df_te['target_time'], b=500
        )

        results["spatial_holdout"][f"h_{h}"] = {
            "held_out_sites": held_out_sites,
            "n_samples": int(len(df_te)),
            "alpha_blend": round(alpha, 4),
            "mae_model": round(mae_m, 2),
            "mae_without_cams_future": round(mae_abl, 2),
            "mae_persistence": round(mae_p, 2),
            "mae_blend": round(mae_b, 2),
            "mae_raw_cams": round(mae_c, 2),
            "mae_cams_bias": round(mae_cb, 2),
            "best_baseline": best_base_name,
            "diff_vs_best_baseline": round(diff_m, 2),
            "ci_95_diff": [round(ci_l, 2), round(ci_h, 2)],
            "coverage_overall_pct": round(cov_overall, 1),
            "top_decile_threshold": round(q90_th, 1),
            "top_decile_n": int(top_mask.sum()),
            "top_decile_mae_model": round(top_mae_m, 2),
            "top_decile_mae_without_cams": round(top_mae_abl, 2),
            "top_decile_mae_persistence": round(top_mae_p, 2),
            "top_decile_mae_blend": round(top_mae_b, 2),
            "top_decile_mae_raw_cams": round(top_mae_c, 2),
            "top_decile_mae_cams_bias": round(top_mae_cb, 2),
            "top_decile_coverage_pct": round(top_cov, 1),
        }
        print(f"  h={h:02d}h: Model={mae_m:.2f} | Persist={mae_p:.2f} | Blend={mae_b:.2f} (a={alpha:.2f}) | CAMS+Bias={mae_cb:.2f} | Raw CAMS={mae_c:.2f} | Diff={diff_m:+.2f} [{ci_l:+.2f}, {ci_h:+.2f}] | Ablation={mae_abl:.2f}", flush=True)

    return results

def train_and_save_production_models(df_all, model_path=None):
    import joblib
    if model_path is None:
        model_path = os.path.join(PROJECT_ROOT, "backend", "data", "station_models.pkl")
    
    full_feature_names = [
        'site_group',
        'lag_1', 'lag_2', 'lag_3', 'lag_6', 'lag_24',
        'roll_mean_6', 'roll_std_6', 'roll_mean_24', 'roll_std_24',
        'cams_issue', 'res_issue', 'res_mean_6', 'res_mean_24',
        'cams_future', 'future_temp', 'future_rh', 'future_ws', 'future_u', 'future_v',
        'sin_hour', 'cos_hour', 'dayofweek'
    ]
    
    lgb_params = {
        'objective': 'regression_l1',
        'metric': 'mae',
        'learning_rate': 0.05,
        'num_leaves': 31,
        'min_child_samples': 50,
        'n_estimators': 150,
        'n_jobs': -1,
        'verbose': -1,
        'random_state': 42
    }
    
    models = {}
    q10_models = {}
    q90_models = {}
    
    for h in HORIZONS:
        print(f"Training production model for h={h}...", flush=True)
        df_h = df_all[df_all['horizon'] == h]
        X = df_h[full_feature_names]
        y = df_h['target_delta']
        
        m_point = lgb.LGBMRegressor(**lgb_params)
        m_point.fit(X, y)
        models[h] = m_point
        
        m_q10 = lgb.LGBMRegressor(objective='quantile', alpha=0.10, learning_rate=0.05, num_leaves=31, n_estimators=100, n_jobs=-1, verbose=-1, random_state=42)
        m_q10.fit(X, y)
        q10_models[h] = m_q10
        
        m_q90 = lgb.LGBMRegressor(objective='quantile', alpha=0.90, learning_rate=0.05, num_leaves=31, n_estimators=100, n_jobs=-1, verbose=-1, random_state=42)
        m_q90.fit(X, y)
        q90_models[h] = m_q90
        
    categories = list(df_all['site_group'].cat.categories)
    
    artifact = {
        "horizons": HORIZONS,
        "models": models,
        "q10_models": q10_models,
        "q90_models": q90_models,
        "feature_names": full_feature_names,
        "categories": categories,
        "site_groups": SITE_GROUPS,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    
    joblib.dump(artifact, model_path)
    print(f"Saved production station models artifact to: {model_path}", flush=True)

def main():
    cams_df, st_dfs = load_data()
    df_all = build_features(cams_df, st_dfs)
    
    if "--save-models" in sys.argv:
        train_and_save_production_models(df_all)
        return
        
    eval_results = run_evaluation(df_all)
    
    output = {
        "execution_timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "n_stations": len(st_dfs),
        "site_groups": list(set(SITE_GROUPS.values())),
        "evaluation": eval_results,
    }
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"\nSuccessfully wrote upgraded evaluation results to: {OUTPUT_PATH}", flush=True)
    
    train_and_save_production_models(df_all)

if __name__ == "__main__":
    main()

