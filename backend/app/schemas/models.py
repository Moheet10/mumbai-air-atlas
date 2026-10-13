from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ProvenanceType(str, Enum):
    OBSERVED = "observed"
    PROVIDER_FORECAST = "provider_forecast"
    ATLAS_MODEL = "atlas_model"
    OBSERVED_SAMPLE = "observed_sample"


class Coordinates(BaseModel):
    latitude: float
    longitude: float


class PollutantReading(BaseModel):
    parameter: str
    display_name: str
    value: Optional[float] = None
    unit: str = "µg/m³"
    timestamp_utc: str
    timestamp_local: str
    provenance: ProvenanceType
    source_name: str
    is_sample: bool = False


class Station(BaseModel):
    id: str
    name: str
    area: str
    agency: str
    coordinates: Coordinates
    status: str = "active"  # "active" | "stale" | "sample" | "offline"
    latest_pm25: Optional[float] = None
    latest_pm10: Optional[float] = None
    latest_timestamp: Optional[str] = None
    provenance: ProvenanceType
    is_sample: bool = False


class WeatherContext(BaseModel):
    temperature_c: float
    relative_humidity_pct: float
    apparent_temperature_c: Optional[float] = None
    precipitation_mm: float = 0.0
    wind_speed_kmh: float
    wind_direction_deg: float
    weather_code: int = 0
    condition_label: str = "Clear"
    timestamp: str
    source_name: str = "Open-Meteo NWP Grid"


class CurrentConditionsResponse(BaseModel):
    location_name: str = "Greater Mumbai"
    coordinates: Coordinates
    primary_pm25: PollutantReading
    comparison_previous_period: Optional[Dict[str, Any]] = None
    other_pollutants: List[PollutantReading] = []
    weather: WeatherContext
    openaq_status: str  # "connected" | "missing_key" | "rate_limited" | "error"
    openaq_message: str
    selected_station: Optional[Station] = None
    generated_at: str


class TimelinePoint(BaseModel):
    timestamp_utc: str
    timestamp_local: str
    value: Optional[float] = None
    unit: str = "µg/m³"
    provenance: ProvenanceType
    source_name: str


class ForecastResponse(BaseModel):
    location_name: str
    coordinates: Coordinates
    station_id: Optional[str] = None
    parameter: str = "pm2_5"
    unit: str = "µg/m³"
    observations: List[TimelinePoint] = []
    provider_forecast: List[TimelinePoint] = []
    atlas_model_forecast: Optional[List[TimelinePoint]] = None
    text_summary: str
    provider_model_name: str = "Copernicus CAMS Atmospheric Ensemble (via Open-Meteo)"
    generated_at: str


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "0.1.0"
    openaq_configured: bool
    open_meteo_reachable: bool
    timestamp: str
