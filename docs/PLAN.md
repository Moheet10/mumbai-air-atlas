# Build Plan — Mumbai Air Quality Dashboard

Four weeks. Each week has an exit criterion. If you miss it, cut scope, don't extend the week.

## Stack

- Data: OpenAQ (station readings; v3 needs a free API key) and Open-Meteo (weather)
- Storage: DuckDB or SQLite file in the repo's data folder, updated by a scheduled GitHub Action
- Backend: FastAPI (read-only endpoints)
- Model: LightGBM, scikit-learn for baselines and metrics
- Frontend: React + Vite, MapLibre, D3 or visx
- Deploy: Vercel for the frontend, Render or Fly for the API

## Week 1 — Data and baseline

Day 1, before anything else: check OpenAQ for Mumbai stations. How many are there, which pollutants do they report, and how patchy are the readings? If coverage is too thin, fall back to Open-Meteo's air quality API (modelled data, not station readings) and say so in the README.

- Ingestion script for pollutants and weather, stored in the database
- GitHub Action running it daily
- Naive baseline forecast ("same as 24 hours ago") with MAE computed
- Repo set up with DESIGN.md, README skeleton, and folder structure

**Exit criterion:** database fills automatically; baseline MAE is printed by a script.

## Week 2 — Model and anomalies (hard stop at end of week)

- Features: lagged AQI, hour of day, day of week, temperature, humidity, wind speed and direction, rain
- LightGBM 48-hour forecast per station
- Split by time (train on earlier, test on later). Never a random split, or your metrics are fake.
- Compare against the baseline. Report MAE and the percentage improvement.
- Anomaly flag: points where the residual or a rolling z-score exceeds a threshold, joined with weather conditions
- FastAPI endpoints: current readings, forecast, anomalies, model metrics

**Exit criterion:** the model beats the baseline, or you have an honest note that it doesn't. Either way, move on.

## Week 3 — Frontend

Build in this order, one screen at a time, screenshotting after each (see DESIGN.md):

1. Design tokens, fonts, and layout skeleton
2. Hero number and summary
3. Forecast chart with uncertainty band
4. Map with stations
5. "What changed" panel and model honesty box
6. Mobile layout at 390px

**Exit criterion:** the full app works locally against the real API.

## Week 4 — Ship it

- Deploy frontend and API
- Tests for the ingestion and feature code (a handful is enough)
- README: what it is, a screenshot or short GIF at the top, live link, architecture diagram, data sources, model results with real numbers, known limitations
- Clean commit history and a short "what I'd do next" section
- Post it on LinkedIn and add it to your resume

**Exit criterion:** a stranger can open the live link and understand the project in 30 seconds.

## Rules for yourself

- No new features after Week 3.
- Cap model tuning at one week total.
- If the model is mediocre, present it honestly. Reviewers trust that more than inflated results.
- Commit at least every working session so the GitHub contribution graph reflects real work.
