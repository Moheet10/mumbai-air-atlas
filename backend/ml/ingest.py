"""
Ingestion script for Mumbai Air Atlas.
Fetches hourly air quality and meteorological data for Mumbai from Open-Meteo
and persists records into SQLite. Supports idempotent ingestion with deduplication.
"""

import os
import sqlite3
import httpx
from datetime import datetime, timezone
import zoneinfo

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "mumbai_air.db")


def init_db(db_path: str = DB_PATH):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS hourly_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp_utc TEXT UNIQUE NOT NULL,
            timestamp_local TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            pm2_5 REAL,
            pm10 REAL,
            nitrogen_dioxide REAL,
            ozone REAL,
            sulphur_dioxide REAL,
            carbon_monoxide REAL,
            temperature_2m REAL,
            relative_humidity_2m REAL,
            precipitation REAL,
            wind_speed_10m REAL,
            wind_direction_10m REAL,
            data_source TEXT NOT NULL,
            ingested_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def ingest_open_meteo(latitude: float = 19.0760, longitude: float = 72.8777, past_days: int = 14) -> int:
    init_db()
    
    # 1. Fetch Air Quality (past days + forecast)
    aq_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    aq_params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ["pm2_5", "pm10", "nitrogen_dioxide", "ozone", "sulphur_dioxide", "carbon_monoxide"],
        "timezone": "Asia/Kolkata",
        "past_days": past_days,
        "forecast_days": 1,
    }
    
    # 2. Fetch Weather
    weather_url = "https://api.open-meteo.com/v1/forecast"
    weather_params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "wind_direction_10m"],
        "timezone": "Asia/Kolkata",
        "past_days": past_days,
        "forecast_days": 1,
    }
    
    with httpx.Client(timeout=15.0) as client:
        aq_resp = client.get(aq_url, params=aq_params)
        aq_resp.raise_for_status()
        aq_data = aq_resp.json()
        
        w_resp = client.get(weather_url, params=weather_params)
        w_resp.raise_for_status()
        w_data = w_resp.json()

    aq_hourly = aq_data.get("hourly", {})
    w_hourly = w_data.get("hourly", {})
    times = aq_hourly.get("time", [])

    pm25_list = aq_hourly.get("pm2_5", [])
    pm10_list = aq_hourly.get("pm10", [])
    no2_list = aq_hourly.get("nitrogen_dioxide", [])
    o3_list = aq_hourly.get("ozone", [])
    so2_list = aq_hourly.get("sulphur_dioxide", [])
    co_list = aq_hourly.get("carbon_monoxide", [])

    w_times = {t: idx for idx, t in enumerate(w_hourly.get("time", []))}
    temp_list = w_hourly.get("temperature_2m", [])
    rh_list = w_hourly.get("relative_humidity_2m", [])
    precip_list = w_hourly.get("precipitation", [])
    ws_list = w_hourly.get("wind_speed_10m", [])
    wd_list = w_hourly.get("wind_direction_10m", [])

    now_utc_str = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    inserted_count = 0

    for idx, t_local_str in enumerate(times):
        try:
            dt_local = datetime.fromisoformat(t_local_str).replace(tzinfo=KOLKATA_TZ)
            dt_utc_str = dt_local.astimezone(timezone.utc).isoformat()
        except Exception:
            continue

        w_idx = w_times.get(t_local_str)
        temp = temp_list[w_idx] if w_idx is not None and w_idx < len(temp_list) else None
        rh = rh_list[w_idx] if w_idx is not None and w_idx < len(rh_list) else None
        precip = precip_list[w_idx] if w_idx is not None and w_idx < len(precip_list) else None
        ws = ws_list[w_idx] if w_idx is not None and w_idx < len(ws_list) else None
        wd = wd_list[w_idx] if w_idx is not None and w_idx < len(wd_list) else None

        cur.execute(
            """
            INSERT OR REPLACE INTO hourly_records (
                timestamp_utc, timestamp_local, latitude, longitude,
                pm2_5, pm10, nitrogen_dioxide, ozone, sulphur_dioxide, carbon_monoxide,
                temperature_2m, relative_humidity_2m, precipitation, wind_speed_10m, wind_direction_10m,
                data_source, ingested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dt_utc_str,
                t_local_str,
                latitude,
                longitude,
                pm25_list[idx] if idx < len(pm25_list) else None,
                pm10_list[idx] if idx < len(pm10_list) else None,
                no2_list[idx] if idx < len(no2_list) else None,
                o3_list[idx] if idx < len(o3_list) else None,
                so2_list[idx] if idx < len(so2_list) else None,
                co_list[idx] if idx < len(co_list) else None,
                temp,
                rh,
                precip,
                ws,
                wd,
                "open_meteo_cams_model",
                now_utc_str,
            ),
        )
        inserted_count += 1

    conn.commit()
    conn.close()
def ingest_archive(
    latitude: float = 19.0760,
    longitude: float = 72.8777,
    start_date: str = "2024-10-01",
    end_date: str = "2026-10-10",
) -> int:
    init_db()

    aq_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    aq_params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ["pm2_5", "pm10", "nitrogen_dioxide", "ozone", "sulphur_dioxide", "carbon_monoxide"],
        "timezone": "Asia/Kolkata",
        "start_date": start_date,
        "end_date": end_date,
    }

    weather_url = "https://archive-api.open-meteo.com/v1/archive"
    weather_params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ["temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "wind_direction_10m"],
        "timezone": "Asia/Kolkata",
        "start_date": start_date,
        "end_date": end_date,
    }

    print(f"Fetching archival AQ & Weather ({start_date} to {end_date})...")
    with httpx.Client(timeout=45.0) as client:
        aq_resp = client.get(aq_url, params=aq_params)
        aq_resp.raise_for_status()
        aq_data = aq_resp.json()

        w_resp = client.get(weather_url, params=weather_params)
        w_resp.raise_for_status()
        w_data = w_resp.json()

    aq_hourly = aq_data.get("hourly", {})
    w_hourly = w_data.get("hourly", {})
    times = aq_hourly.get("time", [])

    pm25_list = aq_hourly.get("pm2_5", [])
    pm10_list = aq_hourly.get("pm10", [])
    no2_list = aq_hourly.get("nitrogen_dioxide", [])
    o3_list = aq_hourly.get("ozone", [])
    so2_list = aq_hourly.get("sulphur_dioxide", [])
    co_list = aq_hourly.get("carbon_monoxide", [])

    w_times = {t: idx for idx, t in enumerate(w_hourly.get("time", []))}
    temp_list = w_hourly.get("temperature_2m", [])
    rh_list = w_hourly.get("relative_humidity_2m", [])
    precip_list = w_hourly.get("precipitation", [])
    ws_list = w_hourly.get("wind_speed_10m", [])
    wd_list = w_hourly.get("wind_direction_10m", [])

    now_utc_str = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    inserted_count = 0

    batch = []
    for idx, t_local_str in enumerate(times):
        try:
            dt_local = datetime.fromisoformat(t_local_str).replace(tzinfo=KOLKATA_TZ)
            dt_utc_str = dt_local.astimezone(timezone.utc).isoformat()
        except Exception:
            continue

        w_idx = w_times.get(t_local_str)
        temp = temp_list[w_idx] if w_idx is not None and w_idx < len(temp_list) else None
        rh = rh_list[w_idx] if w_idx is not None and w_idx < len(rh_list) else None
        precip = precip_list[w_idx] if w_idx is not None and w_idx < len(precip_list) else None
        ws = ws_list[w_idx] if w_idx is not None and w_idx < len(ws_list) else None
        wd = wd_list[w_idx] if w_idx is not None and w_idx < len(wd_list) else None

        batch.append((
            dt_utc_str,
            t_local_str,
            latitude,
            longitude,
            pm25_list[idx] if idx < len(pm25_list) else None,
            pm10_list[idx] if idx < len(pm10_list) else None,
            no2_list[idx] if idx < len(no2_list) else None,
            o3_list[idx] if idx < len(o3_list) else None,
            so2_list[idx] if idx < len(so2_list) else None,
            co_list[idx] if idx < len(co_list) else None,
            temp,
            rh,
            precip,
            ws,
            wd,
            "open_meteo_archive",
            now_utc_str,
        ))

    cur.executemany(
        """
        INSERT OR REPLACE INTO hourly_records (
            timestamp_utc, timestamp_local, latitude, longitude,
            pm2_5, pm10, nitrogen_dioxide, ozone, sulphur_dioxide, carbon_monoxide,
            temperature_2m, relative_humidity_2m, precipitation, wind_speed_10m, wind_direction_10m,
            data_source, ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        batch,
    )
    inserted_count = len(batch)
    conn.commit()
    conn.close()
    return inserted_count


if __name__ == "__main__":
    count = ingest_archive(start_date="2024-10-01", end_date="2026-10-10")
    print(f"Successfully ingested {count} archival hourly records into {DB_PATH}")
