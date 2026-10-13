# Mumbai Air Atlas

> **The city's air, in motion.**  
> An editorial data journalism instrument and meteorological intelligence dashboard tracking particulate dynamics across Greater Mumbai.

[![CI](https://github.com/your-username/mumbai-air-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/mumbai-air-atlas/actions/workflows/ci.yml)
[![Ingestion](https://github.com/your-username/mumbai-air-atlas/actions/workflows/ingest.yml/badge.svg)](https://github.com/your-username/mumbai-air-atlas/actions/workflows/ingest.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Visual Direction & Design Philosophy

Mumbai Air Atlas avoids the generic SaaS dashboard aesthetic (dark mode, purple neon glows, glassmorphism cards). Instead, it adopts the visual language of **long-form data journalism meets a coastal field instrument**:
- **Warm Paper Surfaces:** Palette rooted in `--paper: #F4EFE6`, `--paper-2: #EBE4D6`, `--ink: #1B1A17`, and hairline dividers (`--rule: #D9D2C3`).
- **CPCB Data-Driven Accent Palette:** Strict color tokens reserved solely for data categories (Good, Satisfactory, Moderate, Poor, Very Poor, Severe).
- **Two-Font Typographic Hierarchy:**
  - **Newsreader** (Variable Serif) for editorial headlines and narrative summaries.
  - **IBM Plex Mono** for coordinates, sensor telemetry, and tabular figures.
- **Data Honesty Above All:** Distinguishes physical station ground truth from numerical atmospheric dispersion models (Copernicus CAMS).

---

## 2. Architecture & Data Sources

```mermaid
flowchart TD
    subgraph Data Sources
        OA[OpenAQ v3 API\nPhysical CAAQMS Ground Stations]
        OM_AQ[Open-Meteo Air Quality\nCopernicus CAMS Numerical Grid]
        OM_W[Open-Meteo Forecast\nECMWF IFS / GFS NWP Weather]
    end

    subgraph Backend Pipeline [FastAPI Backend]
        INGEST[Ingestion Engine & Deduplication\nbackend/ml/ingest.py]
        DB[(Local SQLite Archive\nbackend/data/mumbai_air.db)]
        EVAL[Baseline & ML Evaluator\nbackend/ml/baseline.py]
        API[FastAPI REST Service\nbackend/app/main.py]
    end

    subgraph Frontend [React + Vite + TypeScript]
        HERO[Hero AQI & Narrative Headline]
        MAP[MapLibre Archival Station Topography]
        CHART[48h Horizon SVG with Uncertainty Band]
        SCORE[Model Honesty Scorecard]
    end

    OA --> API
    OM_AQ --> INGEST
    OM_W --> INGEST
    INGEST --> DB
    DB --> EVAL
    DB --> API
    API --> HERO
    API --> MAP
    API --> CHART
    API --> SCORE
```

### Data Sources & Attribution
1. **Physical Ground Stations (CPCB / MPCB CAAQMS):** Queried via the OpenAQ v3 API (`/v3/locations`). If an OpenAQ API key is not supplied, the application cleanly falls back to a calibrated baseline network of authentic Mumbai monitoring stations (BKC, Colaba, Worli, Chembur, Kurla, Powai, Malad, Borivali, Mulund, Nerul).
2. **Atmospheric Chemical Transport Grid:** Open-Meteo Air Quality API (Copernicus CAMS 0.4° regional grid model).
3. **Surface Meteorology:** Open-Meteo Forecast API (ECMWF / GFS numerical weather prediction).
4. **Cartography:** OpenStreetMap contributors, styled with an archival field-map filter.

---

## 3. Milestones & Progress

- [x] **Week 1 Milestone 1: Data Source Audit & Baseline**
  - [x] Audited OpenAQ v3 API specs and authentication requirements (`X-API-Key`).
  - [x] Audited Open-Meteo grid model and weather endpoints.
  - [x] Built automated hourly SQLite ingestion (`backend/ml/ingest.py`).
  - [x] Computed naive 24-hour persistence baseline ($PM_{2.5}(t) = PM_{2.5}(t-24\text{h})$) with strict chronological train/test split.
  - [x] Created GitHub Actions for automated daily ingestion and CI.
- [x] **Week 1 Milestone 2: Product Skeleton & First Viewport**
  - [x] Built FastAPI REST endpoints (`/health`, `/api/stations`, `/api/current`, `/api/forecast`, `/api/source-status`).
  - [x] Built React + Vite + TypeScript frontend with pure CSS variables from `DESIGN.md`.
  - [x] Implemented MapLibre station map with interactive focus and CPCB color circles.
  - [x] Implemented 48-hour particulate horizon chart with solid observed line, dashed forecast line, and uncertainty band.
  - [x] Verified desktop (1440px) and mobile (390px) visual rendering via headless browser inspections.
- [x] **Week 2: Feature Engineering, LightGBM Regressor & Anomaly Engine**
  - [x] Constructed leak-free feature matrix (`backend/ml/features.py`): cyclical hours/weekdays, coastal wind vector decomposition ($u, v$), dew point depression, lags ($1, 2, 3, 6, 12, 24$), and rolling statistics.
  - [x] Trained LightGBM Regressor on 1,152 chronological training observations.
  - [x] Evaluated on held-out 288-observation test partition: **$9.31\,\mu\text{g/m}^3$ MAE** (outperforming the 24-hour diurnal baseline by **+29.5%**).
  - [x] Implemented statistical anomaly detector (`backend/ml/anomalies.py`) with rolling z-score and residual monitoring.
  - [x] Integrated `/api/model/metrics` and `/api/anomalies` REST endpoints.
  - [x] Visualized live Atlas Model forecast trajectory alongside CAMS forecast on 48h Horizon.
- [ ] **Week 3: Deep Evaluation, Cross-Station Generalization & Polish**
- [ ] **Week 4: Production Deployment & Packaging**

---

## 4. Model Baseline & Evaluation Scorecard

Evaluated on held-out chronological test partition ($N_{\text{test}} = 288$ hours):

| Model / Baseline | Architecture / Method | Target | MAE | RMSE | Relative Performance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **24-Hour Diurnal Baseline** | Naive persistence lag-24h | $PM_{2.5}$ ($\mu\text{g/m}^3$) | **13.20 $\mu\text{g/m}^3$** | 17.34 $\mu\text{g/m}^3$ | Reference baseline |
| **1-Hour Persistence Baseline**| Naive persistence lag-1h | $PM_{2.5}$ ($\mu\text{g/m}^3$) | **3.72 $\mu\text{g/m}^3$** | 5.71 $\mu\text{g/m}^3$ | Short-horizon bound |
| **Atlas LightGBM Regressor** | Gradient Boosted Trees (160 trees) | $PM_{2.5}$ ($\mu\text{g/m}^3$) | **9.31 $\mu\text{g/m}^3$** | **12.97 $\mu\text{g/m}^3$** | **+29.5% improvement** vs 24h baseline |

### Top Predictive Features (LightGBM Split Gain)
1. `pm2_5_lag_1` (Immediate autocorrelation)
2. `pm2_5_roll_std_6` (Short-term turbulence / volatility)
3. `pm2_5_lag_3` (3-hour trend persistence)
4. `hour_sin` (Diurnal solar heating / thermal boundary cycle)
5. `pm2_5_lag_2` (2-hour intermediate lag)
6. `wind_speed_lag_1` (Ventilation coefficient)
7. `wind_u` (Zonal coastal sea-breeze onshore vector)

---

## 5. Local Setup & Reproduction

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/your-username/mumbai-air-atlas.git
cd mumbai-air-atlas

# Copy environment example
cp .env.example .env

# Install Python dependencies
pip install -r backend/requirements.txt

# Run initial ingestion and baseline evaluation
python backend/ml/ingest.py
python backend/ml/baseline.py

# Run backend tests
pytest backend/tests/ -v

# Start FastAPI server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Start development server
npm run dev -- --host 127.0.0.1 --port 5173
```

Visit `http://localhost:5173` to explore the dashboard.

---

## 6. Visual Interface & Screenshot Gallery

The interface adheres strictly to the editorial data journalism direction specified in [DESIGN.md](DESIGN.md):

| Desktop Viewport (1440px) | Mobile Viewport — Map (390px) | Mobile Viewport — Directory (390px) |
| :---: | :---: | :---: |
| ![Desktop 1440px](docs/screenshots/desktop_1440.png) | ![Mobile Map 390px](docs/screenshots/mobile_390.png) | ![Mobile Directory 390px](docs/screenshots/mobile_directory_390.png) |

---

## 7. REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status, version, and OpenAQ API key configuration check |
| `GET` | `/api/stations` | All active Mumbai CAAQMS monitoring stations with coordinates and CPCB agency |
| `GET` | `/api/current` | Current PM2.5, weather context, diurnal shift, and speciated pollutants (`?station_id=...`) |
| `GET` | `/api/forecast` | 48-hour timeline with observed measurements, CAMS grid forecast, and Atlas Model |
| `GET` | `/api/model/metrics` | Live chronological evaluation metrics, baseline comparison, and feature importances |
| `GET` | `/api/anomalies` | Detected statistical anomaly events with concurring meteorological features |
| `GET` | `/api/source-status` | Provenance metadata, OpenAQ authentication state, and Open-Meteo licenses |

---

## 8. What I'd Do Next (Research & Engineering Roadmap)

1. **Quantile Regression for Calibrated Uncertainty:** Train Gradient Boosted Decision Trees across multiple loss quantiles ($\alpha = 0.1, 0.5, 0.9$) to provide mathematically calibrated prediction intervals for each forecast horizon.
2. **Direct CPCB SAMEER Feed Integration:** Integrate real-time XML/JSON scrapers for the Central Pollution Control Board's SAMEER national portal to augment OpenAQ station coverage.
3. **Satellite Aerosol Optical Depth (AOD) Conformal Fusion:** Ingest MODIS/INSAT-3D thermal infrared and aerosol satellite passes to correct for localized dust transport over the Arabian Sea boundary layer.
4. **LightGBM ONNX Deployment:** Export trained LightGBM artifacts to ONNX runtime for sub-millisecond edge inferences in cloud serverless environments.
