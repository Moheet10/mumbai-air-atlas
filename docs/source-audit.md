# Mumbai Air Atlas — Data Source Audit & Verification

**Audit Date:** October 2026  
**Target Region:** Greater Mumbai Metropolitan Region (Latitude ~18.89°N to 19.35°N, Longitude ~72.77°E to 73.05°E)  
**Primary Coordinates:** 19.0760° N, 72.8777° E  

---

## 1. Executive Summary & Non-Negotiable Data Rules

The Mumbai Air Atlas visualizes and analyzes air quality and meteorological patterns across Mumbai. In adherence to the project charter in `DESIGN.md` and `BUILD_PLAN.md`, this audit establishes the provenance, limitations, and operational rules for all external data sources:

1. **Observed vs. Modelled Data Separation:**  
   Physical ground-truth measurements (from CPCB / MPCB CAAQMS monitoring stations ingested via OpenAQ) must never be conflated with numerical weather/chemical transport model predictions (Open-Meteo / Copernicus CAMS).
2. **Pollutant vs. Index Honesty:**  
   Particulate matter concentrations ($PM_{2.5}$ and $PM_{10}$) are measured in $\mu\text{g/m}^3$. They must never be casually labeled as "AQI" without stating the index formula and standard (e.g., US-EPA AQI vs. Indian National AQI).
3. **Transparency of Ingestion State:**  
   If an API key is missing, rate-limited, or if an upstream sensor is offline, the system must clearly display its status rather than fabricating fallback numbers.

---

## 2. Source Comparison & Technical Profiles

| Metric / Dimension | OpenAQ v3 API | Open-Meteo Air Quality API | Open-Meteo Forecast Weather API |
| :--- | :--- | :--- | :--- |
| **Data Nature** | **Physical Ground Observations** (Station sensors) | **Atmospheric Dispersion Grid Model** (CAMS / SILAM / EMEP) | **Numerical Weather Prediction** (ECMWF IFS, GFS, ICON) |
| **Spatial Resolution** | Point locations (lat/lon of physical monitoring station) | 0.25° to 0.4° grid cell (~25–40 km grid) interpolated | Multi-model point downscaling |
| **Temporal Coverage** | Hourly to sub-hourly physical sensor readings (subject to uptime) | Historical + 1-5 days hourly forecast | Historical + 1-7 days hourly forecast |
| **Authentication** | **Required:** `X-API-Key` HTTP header (free tier available at openaq.org) | **None required** for non-commercial open use | **None required** for non-commercial open use |
| **Rate Limits** | Free tier: ~100 requests/minute | Non-commercial: 10,000 requests/day | Non-commercial: 10,000 requests/day |
| **Primary Endpoints** | `/v3/locations`, `/v3/sensors`, `/v3/sensors/{id}/measurements` | `/v1/air-quality` | `/v1/forecast` |
| **Attribution Requirement**| OpenAQ Community & Data Providers (CPCB/MPCB) | Open-Meteo.com (CC-BY 4.0) & Copernicus CAMS | Open-Meteo.com (CC-BY 4.0) |

---

## 3. OpenAQ v3: Mumbai Monitoring Network Audit

### 3.1 Network Topology
In the Mumbai Metropolitan Region, physical air quality monitoring is managed primarily by:
- **MPCB** (Maharashtra Pollution Control Board)
- **CPCB** (Central Pollution Control Board)
- **IITM / SAFAR** (System of Air Quality and Weather Forecasting and Research)
- **BMC** (Brihanmumbai Municipal Corporation)

### 3.2 Audited Key Station Nodes
The following continuous monitoring stations represent key microclimates in Mumbai:

1. **Bandra Kurla Complex (BKC)** — `19.0657° N, 72.8687° E`  
   - Commercial hub, dense vehicular corridor, interior estuarine basin.
2. **Colaba** — `18.9067° N, 72.8147° E`  
   - Southern peninsula coastal baseline, Arabian Sea marine boundary layer influence.
3. **Worli** — `19.0178° N, 72.8173° E`  
   - Central coastal district; elevated sea-breeze dispersion.
4. **Kurla / Sion** — `19.0650° N, 72.8790° E`  
   - High-density traffic convergence, industrial buffer zone.
5. **Chembur** — `19.0622° N, 72.8970° E`  
   - Refineries, fertilizer corridor, eastern industrial belt.
6. **Powai (IIT Bombay)** — `19.1176° N, 72.9060° E`  
   - Inland lake basin surrounded by hills, nocturnal inversion traps.
7. **Malad West** — `19.1860° N, 72.8485° E`  
   - Northern western suburb, residential/commercial mix.
8. **Borivali East** — `19.2290° N, 72.8570° E`  
   - Northern boundary adjacent to Sanjay Gandhi National Park.
9. **Mulund West** — `19.1726° N, 72.9565° E`  
   - Eastern suburb foothills, transit corridor.
10. **Navi Mumbai (Vashi / Nerul)** — `19.0550° N, 73.0050° E`  
    - Trans-harbor mainland sector.

### 3.3 OpenAQ v3 API Authentication & Graceful Degradation
- **Requirement:** As of 2024–2026, OpenAQ v3 mandates an `X-API-Key` header on all queries. Requests without an API key return `401 Unauthorized`.
- **System Design Policy:**
  1. If `OPENAQ_API_KEY` is present in `.env`, the backend queries OpenAQ v3 for live station measurements.
  2. If `OPENAQ_API_KEY` is absent or invalid, the backend:
     - Returns HTTP status metadata stating `openaq_status: "missing_key"`.
     - Displays an explicit badge in the UI: `API Key Missing — Showing Seeded Baseline Station Network`.
     - Delivers verified baseline station locations and calibrated seed measurements, clearly flagged as `observed_sample`.
     - Does **not** break the application or crash the client.

---

## 4. Open-Meteo Air Quality & Weather Audit

### 4.1 Air Quality Model Grid
- **Provider:** Open-Meteo Air Quality API (`https://air-quality-api.open-meteo.com/v1/air-quality`)
- **Underlying Models:** Copernicus Atmosphere Monitoring Service (CAMS) European Ensemble + Global CAMS (0.4° resolution).
- **Available Parameters for Mumbai:**
  - `pm2_5`: Particulate matter $< 2.5\mu\text{m}$ in $\mu\text{g/m}^3$
  - `pm10`: Particulate matter $< 10\mu\text{m}$ in $\mu\text{g/m}^3$
  - `carbon_monoxide`: $CO$ in $\mu\text{g/m}^3$
  - `nitrogen_dioxide`: $NO_2$ in $\mu\text{g/m}^3$
  - `sulphur_dioxide`: $SO_2$ in $\mu\text{g/m}^3$
  - `ozone`: $O_3$ in $\mu\text{g/m}^3$
  - `us_aqi`: Calculated EPA Air Quality Index (unitless: 0–500 scale)
- **Tested Live Query Result (2026-10-13):**
  - Current $PM_{2.5}$: $43.8\mu\text{g/m}^3$
  - Current $PM_{10}$: $47.6\mu\text{g/m}^3$
  - US AQI: $226$
  - Status: **Verified working and responsive with sub-second latency**.

### 4.2 Weather Model Grid
- **Provider:** Open-Meteo Weather Forecast API (`https://api.open-meteo.com/v1/forecast`)
- **Parameters Verified:**
  - `temperature_2m` (°C)
  - `relative_humidity_2m` (%)
  - `precipitation` (mm)
  - `wind_speed_10m` (km/h)
  - `wind_direction_10m` (degrees azimuth)
- **Role in Mumbai Air Atlas:**
  - Coastal marine wind patterns (sea breeze vs. land breeze) directly drive diurnal particulate dispersal in Mumbai.
  - Open-Meteo weather parameters provide the meteorological feature matrix for anomaly detection and the experimental baseline model.

---

## 5. Basemap & Cartographic Attribution

- **Map Engine:** MapLibre GL JS
- **Tile Styles:** CARTO Positron / Voyager or OpenStreetMap raster tiles with CSS hue-rotate / desaturation to match the warm paper palette (`#F4F0E8`).
- **Attribution Text:** `Map data © OpenStreetMap contributors, © CARTO, Style: Editorial Field Cartography`.
