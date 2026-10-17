import httpx
from datetime import datetime, timezone
import zoneinfo
from typing import List, Dict, Any, Optional
from backend.app.schemas.models import Station, Coordinates, ProvenanceType

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

# Frozen 90-day physical Mumbai CAAQMS monitoring stations from snapshot
# Sources: CPCB CCR, MPCB Regional Network, SAFAR-IITM (Data as of 14 Oct 2026)
SNAPSHOT_MUMBAI_STATIONS: List[Dict[str, Any]] = [
    {
        "id": "3409482",
        "name": "Bandra Kurla Complex, Mumbai - MPCB",
        "area": "Bandra Kurla Complex",
        "agency": "MPCB / IITM-SAFAR",
        "coordinates": {"latitude": 19.0657, "longitude": 72.8687},
        "status": "snapshot",
        "latest_pm25": 62.1,
        "latest_pm10": 98.4,
        "latest_timestamp": "2026-10-13T18:30:00Z",
        "provenance": ProvenanceType.OBSERVED,
        "is_sample": False,
    },
    {
        "id": "11606",
        "name": "Borivali East, Mumbai - IITM",
        "area": "Borivali East",
        "agency": "MPCB / IITM-SAFAR",
        "coordinates": {"latitude": 19.2290, "longitude": 72.8570},
        "status": "snapshot",
        "latest_pm25": 67.6,
        "latest_pm10": 104.2,
        "latest_timestamp": "2026-10-13T18:30:00Z",
        "provenance": ProvenanceType.OBSERVED,
        "is_sample": False,
    },
    {
        "id": "11611",
        "name": "Malad West, Mumbai - IITM",
        "area": "Malad West",
        "agency": "MPCB / IITM-SAFAR",
        "coordinates": {"latitude": 19.1860, "longitude": 72.8485},
        "status": "snapshot",
        "latest_pm25": 58.4,
        "latest_pm10": 92.1,
        "latest_timestamp": "2026-10-13T18:30:00Z",
        "provenance": ProvenanceType.OBSERVED,
        "is_sample": False,
    },
    {
        "id": "6959",
        "name": "Siddharth Nagar-Worli, Mumbai - IITM",
        "area": "Worli",
        "agency": "MPCB / IITM-SAFAR",
        "coordinates": {"latitude": 19.0178, "longitude": 72.8173},
        "status": "snapshot",
        "latest_pm25": 47.5,
        "latest_pm10": 81.3,
        "latest_timestamp": "2026-10-13T18:30:00Z",
        "provenance": ProvenanceType.OBSERVED,
        "is_sample": False,
    },
    {
        "id": "3409483",
        "name": "Chembur, Mumbai - MPCB",
        "area": "Chembur",
        "agency": "MPCB / IITM-SAFAR",
        "coordinates": {"latitude": 19.0622, "longitude": 72.8970},
        "status": "snapshot",
        "latest_pm25": 51.5,
        "latest_pm10": 86.7,
        "latest_timestamp": "2026-10-13T18:30:00Z",
        "provenance": ProvenanceType.OBSERVED,
        "is_sample": False,
    },
]
BASELINE_MUMBAI_STATIONS = SNAPSHOT_MUMBAI_STATIONS


import asyncio
import time
from datetime import datetime, timezone, timedelta

class OpenAQClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.openaq.org/v3",
        timeout_seconds: float = 8.0,
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout_seconds
        self._locations_cache: Optional[Dict[str, Any]] = None
        self._locations_cache_time: float = 0.0
        self._latest_cache: Dict[str, Any] = {}
        self._latest_cache_time: Dict[str, float] = {}
        self.cache_ttl: float = 300.0  # 5 minutes TTL

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def get_locations(
        self,
        latitude: float = 19.0760,
        longitude: float = 72.8777,
        radius_meters: int = 25000,
    ) -> Dict[str, Any]:
        """
        Query OpenAQ v3 /locations endpoint or return structured status.
        OpenAQ v3 requires radius <= 25000 meters.
        Caches results for 5 minutes.
        """
        now_ts = time.time()
        if self._locations_cache is not None and (now_ts - self._locations_cache_time < self.cache_ttl):
            return self._locations_cache

        if not self.is_configured:
            return {
                "status": "snapshot",
                "message": "OpenAQ API Key not configured. Operating in snapshot mode with 5 physical CAAQMS stations as of 14 Oct 2026.",
                "results": self._get_snapshot_stations(),
            }

        headers = {"X-API-Key": self.api_key}
        params = {
            "coordinates": f"{latitude},{longitude}",
            "radius": min(radius_meters, 25000),
            "limit": 30,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.base_url}/locations",
                    headers=headers,
                    params=params,
                )

                if resp.status_code == 401:
                    return {
                        "status": "invalid_key",
                        "message": "Provided OpenAQ API Key was rejected (401 Unauthorized).",
                        "results": self._get_baseline_stations(),
                    }
                elif resp.status_code == 429:
                    return {
                        "status": "rate_limited",
                        "message": "OpenAQ upstream rate limit reached (429 Too Many Requests).",
                        "results": self._get_baseline_stations(),
                    }

                resp.raise_for_status()
                data = resp.json()

                now_utc = datetime.now(timezone.utc)
                cutoff_dt = (now_utc - timedelta(days=14)).isoformat()

                raw_stations = []
                for item in data.get("results", []):
                    coords = item.get("coordinates", {})
                    if not coords.get("latitude") or not coords.get("longitude"):
                        continue

                    sid = str(item.get("id"))
                    name = item.get("name", "Unknown Station")

                    # Skip uncalibrated / test posts with anomalous readings (e.g. 8039)
                    if sid == "8039" or (name == "Mumbai" and item.get("locality") == "India"):
                        continue

                    locality = item.get("locality")
                    area = locality if locality and locality != "None" else (name.split(",")[0].strip() if "," in name else name)
                    agency = item.get("provider", {}).get("name") or "CPCB/MPCB Monitoring Network"
                    dt_last = item.get("datetimeLast", {}).get("utc")

                    is_active = bool(dt_last and dt_last >= cutoff_dt)

                    raw_stations.append(
                        Station(
                            id=sid,
                            name=name,
                            area=area,
                            agency=agency,
                            coordinates=Coordinates(
                                latitude=coords["latitude"],
                                longitude=coords["longitude"],
                            ),
                            status="active" if is_active else "offline",
                            latest_timestamp=dt_last,
                            provenance=ProvenanceType.OBSERVED,
                            is_sample=False,
                        )
                    )

                # Prioritize active stations, with Bandra Kurla Complex (BKC) at #1,
                # followed by authentic CAAQMS stations (MPCB, CPCB, IITM-SAFAR)
                def sort_key(s: Station):
                    is_bkc = "Bandra Kurla" in s.name or "BKC" in s.name
                    is_active = s.status == "active"
                    is_caaqms = any(k in s.name or k in s.agency for k in ["MPCB", "CPCB", "IITM", "SAFAR"])
                    # Lower tuple ranks earlier:
                    # 1. Active BKC (0, 0, 0)
                    # 2. Active CAAQMS (0, 1, 0)
                    # 3. Other active (0, 1, 1)
                    # 4. Offline (1, ...)
                    # 5. Descending latest_timestamp
                    ts = s.latest_timestamp or ""
                    return (
                        0 if is_active else 1,
                        0 if is_bkc else 1,
                        0 if is_caaqms else 1,
                        -ord(ts[0]) if ts else 0,
                    )

                raw_stations.sort(key=sort_key)

                # Parallel fetch latest measurements for the top active stations to enrich PM2.5 / PM10
                active_stations = [s for s in raw_stations if s.status == "active"][:16]
                if active_stations:
                    tasks = [self.get_location_latest(s.id) for s in active_stations]
                    measurements = await asyncio.gather(*tasks, return_exceptions=True)
                    for s, m in zip(active_stations, measurements):
                        if isinstance(m, dict):
                            pm25_info = m.get("pm25")
                            if pm25_info and pm25_info.get("value") is not None:
                                s.latest_pm25 = round(pm25_info["value"], 1)
                                if pm25_info.get("dt_local"):
                                    s.latest_timestamp = pm25_info["dt_local"]
                            pm10_info = m.get("pm10")
                            if pm10_info and pm10_info.get("value") is not None:
                                s.latest_pm10 = round(pm10_info["value"], 1)

                result = {
                    "status": "connected",
                    "message": f"Successfully loaded {len(raw_stations)} physical CAAQMS stations from OpenAQ v3.",
                    "results": raw_stations,
                }
                self._locations_cache = result
                self._locations_cache_time = now_ts
                return result

        except Exception as e:
            return {
                "status": "error",
                "message": f"OpenAQ upstream error: {str(e)}",
                "results": self._get_baseline_stations(),
            }

    async def get_location_latest(self, location_id: str | int) -> Dict[str, Any]:
        """
        Fetch latest real-time pollutant measurements for a specific location.
        Maps sensor IDs to parameter names (pm25, pm10, no2, so2, o3, co).
        Caches per location for 5 minutes.
        """
        if not self.is_configured:
            return {}

        loc_str = str(location_id)
        now_ts = time.time()
        if loc_str in self._latest_cache and (now_ts - self._latest_cache_time.get(loc_str, 0) < self.cache_ttl):
            return self._latest_cache[loc_str]

        headers = {"X-API-Key": self.api_key}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 1. Fetch sensor mapping for this location
                loc_resp = await client.get(f"{self.base_url}/locations/{location_id}", headers=headers)
                if loc_resp.status_code != 200:
                    return {}
                loc_data = loc_resp.json().get("results", [{}])[0]
                sensor_param_map = {
                    s["id"]: s.get("parameter", {}).get("name")
                    for s in loc_data.get("sensors", [])
                }

                # 2. Fetch latest measurements
                latest_resp = await client.get(f"{self.base_url}/locations/{location_id}/latest", headers=headers)
                if latest_resp.status_code != 200:
                    return {}
                latest_data = latest_resp.json().get("results", [])

                latest_by_param: Dict[str, Any] = {}
                for r in latest_data:
                    sid = r.get("sensorsId")
                    param = sensor_param_map.get(sid)
                    if param:
                        dt_utc = r.get("datetime", {}).get("utc")
                        dt_local = r.get("datetime", {}).get("local")
                        val = r.get("value")
                        if param not in latest_by_param or (dt_utc and dt_utc > latest_by_param[param]["dt_utc"]):
                            latest_by_param[param] = {
                                "value": float(val) if val is not None else None,
                                "dt_utc": dt_utc,
                                "dt_local": dt_local,
                            }
                self._latest_cache[loc_str] = latest_by_param
                self._latest_cache_time[loc_str] = now_ts
                return latest_by_param
        except Exception:
            return {}

    def _get_snapshot_stations(self) -> List[Station]:
        return [
            Station(
                id=s["id"],
                name=s["name"],
                area=s["area"],
                agency=s["agency"],
                coordinates=Coordinates(**s["coordinates"]),
                status=s["status"],
                latest_pm25=s["latest_pm25"],
                latest_pm10=s["latest_pm10"],
                latest_timestamp=s["latest_timestamp"],
                provenance=s["provenance"],
                is_sample=s["is_sample"],
            )
            for s in SNAPSHOT_MUMBAI_STATIONS
        ]

    def _get_baseline_stations(self) -> List[Station]:
        return self._get_snapshot_stations()
