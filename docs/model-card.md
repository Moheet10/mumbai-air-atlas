# Model Card — Mumbai Air Atlas LightGBM Regressor

## Model Details

- **Model Name:** Mumbai Air Atlas Particulate Regressor (`atlas-lgbm-pm25-v1`)
- **Version:** `1.0.0`
- **Release Date:** October 2026
- **Architecture:** Gradient Boosted Decision Trees (GBDT) via LightGBM (`LGBMRegressor`)
- **Target Variable:** Continuous fine particulate concentration ($PM_{2.5}$) measured in $\mu\text{g/m}^3$
- **Primary Use Case:** 48-hour forward forecasting and baseline comparison across the Greater Mumbai urban airshed.
- **Developer / Maintainer:** Mumbai Air Atlas Open Intelligence Team

---

## Intended Use & Scope

### Primary Intended Uses
- Providing meteorological-conditioned estimates of particulate concentration trends across Greater Mumbai.
- Benchmarking machine learning predictive power against naive persistence heuristics ($PM_{2.5}(t) = PM_{2.5}(t - 24\text{h})$).
- Detecting atmospheric anomalies and nocturnal inversion events through model residuals.

### Out-of-Scope & Prohibited Uses
- **Clinical / Medical Decision-Making:** This model does not predict individual health outcomes, asthma exacerbation, or respiratory toxicity.
- **Air Quality Index Conflation:** Model predictions are strictly particulate concentrations ($\mu\text{g/m}^3$) and must never be labeled as dimensionless AQI without explicit breakpoint conversion.
- **Regulatory Compliance Enforcement:** Cannot substitute for statutory physical monitoring stations certified by CPCB or MPCB.

---

## Training Data & Preprocessing

- **Dataset Source:** Open-Meteo European Ensemble CAMS atmospheric dispersion model downscaled to Greater Mumbai ($19.0760^\circ\text{N}, 72.8777^\circ\text{E}$) synchronized with physical continuous monitoring stations (CAAQMS).
- **Observation Frequency:** Hourly continuous time series ($1,464$ chronological hours).
- **Partitioning Strategy:** **Strict Chronological Forward Split** (80% training window: $1,152$ hours; 20% held-out test window: $288$ hours). Random cross-validation was strictly prohibited to prevent temporal data leakage.
- **Engineered Feature Space ($25$ features):**
  - *Autoregressive Lags:* $t-1, t-2, t-3, t-6, t-12, t-24$ hours.
  - *Rolling Statistics:* 6-hour moving average, 6-hour volatility (standard deviation), 24-hour diurnal baseline.
  - *Diurnal & Weekly Cyclical Encodings:* $\sin(2\pi \cdot \text{hour}/24)$, $\cos(2\pi \cdot \text{hour}/24)$, weekend indicator.
  - *Coastal Meteorology:* Zonal ($u$, positive for onshore Arabian Sea breeze) and meridional ($v$) wind velocity vector decomposition.
  - *Thermodynamics:* Dew-point depression ($T - T_d \approx (100 - RH)/5$) indicating marine boundary layer saturation and fog/mist formation.

---

## Quantitative Evaluation

### Benchmarks & Held-out Test Metrics ($N_{\text{test}} = 288$ hours)

| Model / Heuristic | Architecture | MAE ($\mu\text{g/m}^3$) | RMSE ($\mu\text{g/m}^3$) | Evaluation Verdict |
| :--- | :--- | :---: | :---: | :--- |
| **24-Hour Diurnal Baseline** | Persistence lag-24h | $13.20$ | $17.34$ | Primary benchmark |
| **1-Hour Persistence Baseline** | Persistence lag-1h | $3.72$ | $5.71$ | Short-horizon bound |
| **Atlas LightGBM Regressor** | GBDT (160 estimators) | $\mathbf{9.31}$ | $\mathbf{12.97}$ | **$+29.5\%$ gain over 24h baseline** |

### Top Feature Importances (Split Gain)
1. `pm2_5_lag_1` ($809$ splits) — Autoregressive inertia.
2. `pm2_5_roll_std_6` ($291$ splits) — Boundary-layer turbulence.
3. `pm2_5_lag_3` ($290$ splits) — Mesoscale trend persistence.
4. `hour_sin` ($281$ splits) — Diurnal solar flux cycle.
5. `pm2_5_lag_2` ($252$ splits) — Intermediate temporal lag.
6. `wind_speed_lag_1` & `wind_u` ($217$ splits) — Marine ventilation coefficient.

---

## Ethical Considerations & Known Limitations

1. **Grid Resolution vs. Micro-Local Street Canyons:** The underlying atmospheric features are derived from regional grid points and cannot capture localized vehicular exhaust at a specific street junction.
2. **Extreme Episodic Events (Diwali / Waste Combustion):** Tree-based models tend to underestimate peak spikes during unprecedented episodic events outside the distribution of the training window.
3. **Transparency Commitment:** If the model fails to outperform the diurnal baseline during a specific weather regime, the dashboard explicitly highlights the baseline score rather than obscuring model deficiencies.
