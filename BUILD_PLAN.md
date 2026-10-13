# Mumbai Air Atlas — Build Plan

**Goal:** Ship one polished, credible portfolio project in four weeks. The project is not complete until the live demo works, the README explains the data/model honestly, and the repository is reproducible.

## Product scope

Build a Mumbai-focused air-quality and weather dashboard with a station map, recent observations, a 48-hour forecast view, anomaly highlights, and an evaluation panel for the project's own model.

**Non-negotiable data rule:** Keep observed measurements, third-party forecasts, and the Atlas model's predictions separate in the API and UI.

## Suggested stack

- **Frontend:** React, Vite, TypeScript, CSS variables/custom CSS, MapLibre GL JS, a single chart library such as Recharts or Visx.
- **Backend:** Python, FastAPI, Pydantic.
- **Data/model:** pandas, scikit-learn; start with a persistence baseline and a simple tree-based regressor. Use LightGBM only if installation and deployment remain straightforward.
- **Storage:** SQLite locally for the first milestone. For deployment with scheduled ingestion, use a small managed PostgreSQL database rather than expecting an ephemeral hosting filesystem to persist data.
- **Automation:** GitHub Actions for tests and, after ingestion is reliable, a daily collection job. Store API keys in GitHub Secrets/environment variables; never commit them.
- **Deployment shape:** static frontend hosting + API hosting + persistent database. Keep the first deployment boring and reliable.

## Week 1 — Prove the data, then establish the product skeleton

### Milestone 1: Source audit (first 1–2 sessions)

1. Get an OpenAQ API key and query the v3 API for Mumbai-area locations and sensors.
2. Confirm which locations actually provide PM2.5, the most recent timestamp, units, and enough historical measurements for evaluation. Record exact station IDs and source/provider names.
3. Test Open-Meteo weather and Air Quality API responses for Mumbai coordinates. Treat Open-Meteo's air-quality output as a grid-based model forecast, not as a physical station measurement.
4. Check the current API usage/licence limits and tile-style attribution before deployment.
5. Save a small sample response and document missing fields, stale stations, unit differences, and pagination.

**Gate:** Do not promise station-level ML forecasts until real data coverage and history are verified. If station history is too sparse, ship a valid current-conditions + provider-forecast dashboard and present a clearly labelled city/grid-level experimental model only if its training and evaluation data support it.

### Milestone 2: Skeleton and first viewport

- Create `frontend/` and `backend/` (or a clearly documented monorepo structure).
- Add `DESIGN.md` to repository root and tell Antigravity: “Read DESIGN.md first. Implement only the first viewport and the map/chart layout. Do not add unrequested sections or generic dashboard cards.”
- Build the masthead, editorial headline, current-reading strip, empty chart frame, and loading/error states using seeded **sample data labelled as sample**.
- Add linting, formatting, environment example files, and a root README with setup commands.

**Definition of done:** frontend and backend start locally using the README, with no secrets in source control.

## Week 2 — Ingestion and data quality

- Implement one OpenAQ client with timeout, pagination, backoff for 429/5xx, structured logs, and clear errors for a missing key.
- Normalize timestamps to UTC internally; show Asia/Kolkata time in the UI. Normalize units explicitly and preserve the provider's raw value/unit for auditing.
- Store station, sensor, pollutant, timestamp, value, unit, provider, source ID, ingestion time, and validation flags.
- Deduplicate measurements with a stable natural key; do not replace missing measurements with zero.
- Add weather context and provider forecasts from Open-Meteo, storing them separately from observations.
- Add `GET /health`, `GET /stations`, `GET /observations`, `GET /forecast`, and `GET /model/metrics` endpoints. Use Pydantic response schemas.
- Write tests for pagination, missing values, duplicate records, unit conversion, timestamps, and upstream failures.

**Definition of done:** data can be fetched repeatedly without duplicates; API responses are typed and documented; all source timestamps remain visible.

## Week 3 — Model, baselines, and trustworthy evaluation

### Start with a baseline

- Establish a persistence baseline, e.g. the latest available value carried forward, for each forecast horizon you evaluate.
- Use a chronological train/validation/test split, never a random split for future prediction.
- Only train on locations/pollutants with sufficient, reasonably regular observations. Publish counts and coverage so the reader knows the sample size.
- Start with lag features, rolling statistics computed only from past data, hour-of-day/day-of-week, and weather features whose availability at prediction time is defensible.
- Compare a simple scikit-learn tree-based model to the baseline using MAE and RMSE by forecast horizon and station. Also report a naive baseline score.
- Check for data leakage. If historical *weather forecasts as originally issued* are unavailable, don't use realized future weather as if the model knew it at prediction time. Either run a clearly labelled retrospective experiment or use only features available at forecast issue time.
- Add an anomaly detector only after the ingestion and labels are stable. Flag anomalies for review, not as confirmed pollution events.

### Forecast fallback policy

If the observations are too sparse or the custom model fails to beat the baseline on a held-out period, do not hide that fact. Keep the provider forecast available, mark the Atlas model as experimental/unavailable, and show the real evaluation metrics in the methodology panel. Do not fabricate a 48-hour confidence band.

**Definition of done:** a reproducible training/evaluation command creates saved metrics and a model artifact; test-period metrics in the UI match the evaluation output.

## Week 4 — Visual polish, deployment, and portfolio packaging

- Connect real data to the map, reading, forecast, source label, and timestamp.
- Make station selection update the map, detail panel, and chart together.
- Add “What changed” using transparent rules: largest measured change, freshness gap, unusual value compared with a historical rolling window, and available weather context. Phrase associations cautiously; don't claim weather caused a spike.
- Implement mobile map/list toggle, keyboard navigation, reduced motion, responsive chart tooltips, and accessible text summaries.
- Add GitHub Actions CI for frontend lint/build and backend tests. Add scheduled ingestion only after manual ingestion works; schedule off the top of the hour and support manual dispatch.
- Deploy frontend/API/database, verify production environment variables, and add a status/last-updated indication.
- Write README sections: problem, screenshots/GIF, live demo, architecture diagram, data sources/attribution, setup, API endpoints, model evaluation, limitations, future work.
- Record a 60–90 second demo showing station selection, time-series changes, forecast source distinction, and the model scorecard.

**Definition of done:** a stranger can open the demo, understand what data they're looking at, and reproduce the project from the README.

## Repository structure

```text
mumbai-air-atlas/
├── DESIGN.md
├── BUILD_PLAN.md
├── README.md
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── ingest.yml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   ├── styles/
│   │   └── types/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── clients/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── ml/
│   │   ├── features.py
│   │   ├── train.py
│   │   └── evaluate.py
│   ├── tests/
│   └── requirements.txt
└── docs/
    ├── architecture.md
    └── model-card.md
```

Adjust this only when the codebase gives a concrete reason; do not create empty folders just to match a diagram.

## Antigravity working rules

Paste this into your project agent instructions:

> Read `DESIGN.md` and `BUILD_PLAN.md` before writing code. Follow the design system exactly. Work milestone-by-milestone; don't generate the whole application in one pass. Before coding each milestone, state the files you will change and the acceptance checks you will satisfy. After implementing, run the relevant tests/build and inspect a browser screenshot at desktop and mobile widths. Fix visual defects before adding features. Do not invent station data, API responses, citations, or model scores. Preserve existing working code and make small, reviewable changes. Keep credentials in environment variables.

Use this loop for each milestone:

1. Ask the agent to implement one named milestone only.
2. Run the app and tests.
3. Use the browser/Playwright tool to inspect the screenshot and console.
4. Write a short list of visual/functional defects.
5. Ask the agent to fix that list without redesigning unrelated sections.
6. Commit the verified state.

## Evaluation and portfolio checklist

- [ ] Real station/sensor availability in Mumbai documented.
- [ ] All observed and forecast data carry provenance and timestamps.
- [ ] No future-information leakage in model evaluation.
- [ ] Baseline and custom model metrics reported on a time-based holdout.
- [ ] Missingness, coverage, and limitations disclosed.
- [ ] API keys stored as secrets; `.env` excluded from Git.
- [ ] CI runs tests/build.
- [ ] Deployment works without local files.
- [ ] Desktop and mobile screenshots are included in README.
- [ ] Demo video under 90 seconds.
- [ ] At least one issue or roadmap section describes the next research/engineering step.

## Source documentation

- [OpenAQ API overview](https://docs.openaq.org/about/about)
- [OpenAQ API key](https://docs.openaq.org/using-the-api/api-key)
- [OpenAQ rate limits](https://docs.openaq.org/using-the-api/rate-limits)
- [OpenAQ measurements resource](https://docs.openaq.org/resources/measurements)
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [GitHub Actions schedule event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
