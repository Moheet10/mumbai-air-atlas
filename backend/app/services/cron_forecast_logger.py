"""
cron_forecast_logger.py
Scheduled forecast logger running every 6 hours.
Rounds issue_time to the top of the hour (e.g. 2026-10-14T10:00:00Z)
and logs 48-hour CAMS and Atlas forecasts for all candidate stations
into the `forecast_log` table.
"""

import os
import sys
import asyncio
import sqlite3
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.services.data_service import DataService
from backend.app.services.forecast_logger import log_forecast_run, init_forecast_log_table, DB_PATH

data_service = DataService()

async def run_scheduled_logging():
    init_forecast_log_table(DB_PATH)
    
    # 1. Round issue_time to the top of the hour
    now_utc = datetime.now(timezone.utc)
    issue_time_rounded = now_utc.replace(minute=0, second=0, microsecond=0).isoformat()
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting scheduled 6-hour forecast logger...")
    print(f"Rounded issue_time: {issue_time_rounded}")

    # 2. Get list of active stations
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT station_id FROM station_hourly WHERE timestamp_utc >= '2025-02-01' ORDER BY station_id")
    station_ids = [row[0] for row in cur.fetchall()]
    conn.close()

    # Also log regional grid
    all_targets = ["mumbai_grid"] + station_ids
    print(f"Logging 48h forecasts for {len(all_targets)} monitoring targets (1 regional grid + {len(station_ids)} stations)...")

    total_inserted = 0
    for idx, sid in enumerate(all_targets):
        try:
            target_sid = None if sid == "mumbai_grid" else sid
            res = await data_service.get_forecast(station_id=target_sid)
            
            cams_pts = [p.model_dump() if hasattr(p, "model_dump") else p.dict() if hasattr(p, "dict") else p for p in res.provider_forecast]
            atlas_pts = [p.model_dump() if hasattr(p, "model_dump") else p.dict() if hasattr(p, "dict") else p for p in res.atlas_model_forecast] if res.atlas_model_forecast else None

            count = log_forecast_run(
                issue_time_utc=issue_time_rounded,
                station_id=sid,
                cams_points=cams_pts,
                atlas_points=atlas_pts,
                db_path=DB_PATH,
            )
            total_inserted += count
        except Exception as e:
            print(f"  Warning: failed to log station {sid}: {e}")

    print(f"Scheduled forecast run complete. Total forecast entries logged: {total_inserted}")

def main():
    asyncio.run(run_scheduled_logging())

if __name__ == "__main__":
    main()
