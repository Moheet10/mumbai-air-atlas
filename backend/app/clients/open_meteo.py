import httpx
import time
from datetime import datetime, timezone
import zoneinfo
from typing import Dict, Any, Optional, Tuple

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
CACHE_TTL_SECONDS = 1800  # 30 minutes


class OpenMeteoClient:
    def __init__(
        self,
        weather_base_url: str = "https://api.open-meteo.com/v1",
        aq_base_url: str = "https://air-quality-api.open-meteo.com/v1",
        timeout_seconds: float = 8.0,
    ):
        self.weather_base_url = weather_base_url
        self.aq_base_url = aq_base_url
        self.timeout = timeout_seconds
        # In-memory TTL cache: key -> (timestamp, data)
        self._cache: Dict[str, Tuple[float, Any]] = {}

    def _get_cached(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, data = self._cache[key]
            if (time.time() - ts) < CACHE_TTL_SECONDS:
                return data
        return None

    def _set_cached(self, key: str, data: Any):
        self._cache[key] = (time.time(), data)

    async def get_air_quality(
        self,
        latitude: float = 19.0760,
        longitude: float = 72.8777,
        forecast_days: int = 3,
        past_days: int = 1,
    ) -> Dict[str, Any]:
        cache_key = f"aq_{latitude}_{longitude}_{forecast_days}_{past_days}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        url = f"{self.aq_base_url}/air-quality"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": [
                "pm2_5",
                "pm10",
                "carbon_monoxide",
                "nitrogen_dioxide",
                "sulphur_dioxide",
                "ozone",
                "us_aqi",
            ],
            "hourly": [
                "pm2_5",
                "pm10",
                "nitrogen_dioxide",
                "ozone",
                "us_aqi",
            ],
            "timezone": "Asia/Kolkata",
            "forecast_days": forecast_days,
            "past_days": past_days,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            self._set_cached(cache_key, data)
            return data

    async def get_weather(
        self,
        latitude: float = 19.0760,
        longitude: float = 72.8777,
        forecast_days: int = 3,
        past_days: int = 1,
    ) -> Dict[str, Any]:
        cache_key = f"weather_{latitude}_{longitude}_{forecast_days}_{past_days}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        url = f"{self.weather_base_url}/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "wind_speed_10m",
                "wind_direction_10m",
                "weather_code",
            ],
            "hourly": [
                "temperature_2m",
                "relative_humidity_2m",
                "wind_speed_10m",
                "wind_direction_10m",
            ],
            "timezone": "Asia/Kolkata",
            "forecast_days": forecast_days,
            "past_days": past_days,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            self._set_cached(cache_key, data)
            return data

    def get_weather_description(self, code: int) -> str:
        code_map = {
            0: "Clear sky",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast / Haze",
            45: "Fog",
            48: "Depositing rime fog",
            51: "Light drizzle",
            53: "Moderate drizzle",
            55: "Dense drizzle",
            61: "Slight rain",
            63: "Moderate rain",
            65: "Heavy rain",
            71: "Slight snow",
            73: "Moderate snow",
            75: "Heavy snow",
            80: "Slight rain showers",
            81: "Moderate rain showers",
            82: "Violent rain showers",
            95: "Thunderstorm",
            96: "Thunderstorm with slight hail",
            99: "Thunderstorm with heavy hail",
        }
        return code_map.get(code, "Clear")
