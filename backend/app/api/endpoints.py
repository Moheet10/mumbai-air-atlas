from fastapi import APIRouter, Query
from datetime import datetime, timezone
from typing import Optional
from backend.app.schemas.models import (
    HealthResponse,
    CurrentConditionsResponse,
    ForecastResponse,
)
from backend.app.services.data_service import DataService

router = APIRouter()
data_service = DataService()


@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
async def get_health():
    now_utc = datetime.now(timezone.utc).isoformat()
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        openaq_configured=data_service.openaq.is_configured,
        open_meteo_reachable=True,
        timestamp=now_utc,
    )


@router.get("/api/stations")
async def get_stations():
    return await data_service.get_stations()


@router.get("/api/stations/{station_id}/history")
async def get_station_history(station_id: str, days: int = Query(60, ge=7, le=90)):
    return await data_service.get_station_history(station_id=station_id, days=days)


@router.get("/api/current", response_model=CurrentConditionsResponse)
async def get_current_conditions(
    station_id: Optional[str] = Query(None, description="Optional ID of specific station to inspect")
):
    return await data_service.get_current_conditions(station_id=station_id)


@router.get("/api/forecast", response_model=ForecastResponse)
async def get_forecast(
    station_id: Optional[str] = Query(None, description="Optional ID of station")
):
    return await data_service.get_forecast(station_id=station_id)


@router.get("/api/scorecard/live")
async def get_live_scorecard(
    station_id: Optional[str] = Query(None, description="Optional ID of station to score")
):
    from backend.app.services.forecast_logger import evaluate_live_scorecard
    return evaluate_live_scorecard(station_id=station_id)


@router.get("/api/model/metrics")
async def get_model_metrics():
    return data_service.get_model_metrics()


@router.get("/api/anomalies")
async def get_anomalies():
    return data_service.get_anomalies()


@router.get("/api/source-status")
async def get_source_status():
    return {
        "openaq": {
            "configured": data_service.openaq.is_configured,
            "auth_type": "X-API-Key header",
            "documentation": "https://docs.openaq.org/using-the-api/api-key",
            "status_message": (
                "Connected to OpenAQ v3 live API"
                if data_service.openaq.is_configured
                else "OPENAQ_API_KEY not configured. Baseline Mumbai monitoring network active (curated sample)."
            ),
        },
        "open_meteo_air_quality": {
            "nature": "Atmospheric dispersion numerical grid model (CAMS Ensemble)",
            "license": "CC-BY 4.0 Open-Meteo / Copernicus",
            "status": "Operational / Live",
        },
        "open_meteo_weather": {
            "nature": "Numerical Weather Prediction (NWP) Surface Diagnostics",
            "license": "CC-BY 4.0 Open-Meteo",
            "status": "Operational / Live",
        },
    }
