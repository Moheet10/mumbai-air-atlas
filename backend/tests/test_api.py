import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "openaq_configured" in data
    assert "timestamp" in data


def test_stations_endpoint():
    response = client.get("/api/stations")
    assert response.status_code == 200
    data = response.json()
    assert "stations" in data
    assert len(data["stations"]) > 0
    first = data["stations"][0]
    assert "coordinates" in first
    assert "latitude" in first["coordinates"]
    assert "longitude" in first["coordinates"]
    assert first["provenance"] in ["observed", "observed_sample"]


def test_current_conditions_endpoint():
    response = client.get("/api/current")
    assert response.status_code == 200
    data = response.json()
    assert "primary_pm25" in data
    assert data["primary_pm25"]["unit"] == "µg/m³"
    assert data["primary_pm25"]["value"] is not None
    assert "provenance" in data["primary_pm25"]
    # Verify weather context
    assert "weather" in data
    assert "temperature_c" in data["weather"]
    assert "wind_speed_kmh" in data["weather"]


def test_forecast_endpoint_distinction():
    response = client.get("/api/forecast")
    assert response.status_code == 200
    data = response.json()
    assert "observations" in data
    assert "provider_forecast" in data
    # Ensure provider forecast has distinct provenance
    if len(data["provider_forecast"]) > 0:
        first_fc = data["provider_forecast"][0]
        assert first_fc["provenance"] == "provider_forecast"
    assert "text_summary" in data
