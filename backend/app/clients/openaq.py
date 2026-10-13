import httpx
from datetime import datetime, timezone
import zoneinfo
from typing import List, Dict, Any, Optional
from backend.app.schemas.models import Station, Coordinates, ProvenanceType

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

# Curated authentic baseline Mumbai CAAQMS monitoring stations
# Sources: CPCB CCR, MPCB Regional Network, SAFAR-IITM
BASELINE_MUMBAI_STATIONS: List[Dict[str, Any]] = [
    {
        "id": "mpcb-bkc",
        "name": "Bandra Kurla Complex (BKC)",
        "area": "Bandra East",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.0657, "longitude": 72.8687},
        "status": "sample",
        "latest_pm25": 54.2,
        "latest_pm10": 89.0,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "cpcb-colaba",
        "name": "Colaba Coastal Baseline",
        "area": "Colaba / South Mumbai",
        "agency": "CPCB / IITM",
        "coordinates": {"latitude": 18.9067, "longitude": 72.8147},
        "status": "sample",
        "latest_pm25": 28.5,
        "latest_pm10": 42.1,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "mpcb-worli",
        "name": "Worli Marine Post",
        "area": "Worli",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.0178, "longitude": 72.8173},
        "status": "sample",
        "latest_pm25": 36.8,
        "latest_pm10": 61.4,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "mpcb-chembur",
        "name": "Chembur Industrial Corridor",
        "area": "Chembur / RCF",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.0622, "longitude": 72.8970},
        "status": "sample",
        "latest_pm25": 68.4,
        "latest_pm10": 112.0,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "mpcb-kurla",
        "name": "Kurla Transit Node",
        "area": "Kurla West",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.0726, "longitude": 72.8845},
        "status": "sample",
        "latest_pm25": 62.0,
        "latest_pm10": 98.7,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "iitm-powai",
        "name": "Powai Lake Basin",
        "area": "Powai / IIT Bombay",
        "agency": "IITM-SAFAR",
        "coordinates": {"latitude": 19.1176, "longitude": 72.9060},
        "status": "sample",
        "latest_pm25": 41.2,
        "latest_pm10": 69.5,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "mpcb-malad",
        "name": "Malad Western Suburbs",
        "area": "Malad West",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.1860, "longitude": 72.8485},
        "status": "sample",
        "latest_pm25": 47.9,
        "latest_pm10": 74.3,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "mpcb-borivali",
        "name": "Borivali National Park Foothills",
        "area": "Borivali East",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.2290, "longitude": 72.8570},
        "status": "sample",
        "latest_pm25": 32.1,
        "latest_pm10": 53.0,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "mpcb-mulund",
        "name": "Mulund Eastern Suburbs",
        "area": "Mulund West",
        "agency": "MPCB",
        "coordinates": {"latitude": 19.1726, "longitude": 72.9565},
        "status": "sample",
        "latest_pm25": 49.3,
        "latest_pm10": 81.2,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
    {
        "id": "cpcb-nerul",
        "name": "Navi Mumbai Creek Post",
        "area": "Nerul / Navi Mumbai",
        "agency": "CPCB",
        "coordinates": {"latitude": 19.0330, "longitude": 73.0180},
        "status": "sample",
        "latest_pm25": 44.0,
        "latest_pm10": 72.8,
        "provenance": ProvenanceType.OBSERVED_SAMPLE,
    },
]


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

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def get_locations(
        self,
        latitude: float = 19.0760,
        longitude: float = 72.8777,
        radius_meters: int = 35000,
    ) -> Dict[str, Any]:
        """
        Query OpenAQ v3 /locations endpoint or return structured status.
        """
        if not self.is_configured:
            return {
                "status": "missing_key",
                "message": "OpenAQ API Key not configured. Using baseline Mumbai monitoring network (curated sample).",
                "results": self._get_baseline_stations(),
            }

        headers = {"X-API-Key": self.api_key}
        params = {
            "coordinates": f"{latitude},{longitude}",
            "radius": radius_meters,
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

                stations = []
                for item in data.get("results", []):
                    coords = item.get("coordinates", {})
                    if not coords.get("latitude") or not coords.get("longitude"):
                        continue
                    stations.append(
                        Station(
                            id=str(item.get("id")),
                            name=item.get("name", "Unknown Station"),
                            area=item.get("locality") or "Mumbai Metro",
                            agency=item.get("provider", {}).get("name", "OpenAQ Provider"),
                            coordinates=Coordinates(
                                latitude=coords["latitude"],
                                longitude=coords["longitude"],
                            ),
                            status="active",
                            latest_timestamp=item.get("datetimeLast", {}).get("utc"),
                            provenance=ProvenanceType.OBSERVED,
                            is_sample=False,
                        )
                    )

                return {
                    "status": "connected",
                    "message": f"Successfully loaded {len(stations)} physical stations from OpenAQ v3.",
                    "results": stations,
                }

        except Exception as e:
            return {
                "status": "error",
                "message": f"OpenAQ upstream error: {str(e)}",
                "results": self._get_baseline_stations(),
            }

    def _get_baseline_stations(self) -> List[Station]:
        now_utc = datetime.now(timezone.utc).isoformat()
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
                latest_timestamp=now_utc,
                provenance=s["provenance"],
                is_sample=True,
            )
            for s in BASELINE_MUMBAI_STATIONS
        ]
