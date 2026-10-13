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
    assert "text_summary" in data
    # Ensure provider forecast has distinct provenance
    if len(data["provider_forecast"]) > 0:
        first_fc = data["provider_forecast"][0]
        assert first_fc["provenance"] == "provider_forecast"
    # Ensure atlas model forecast has distinct provenance when present
    if data.get("atlas_model_forecast"):
        assert len(data["atlas_model_forecast"]) > 0
        first_atlas = data["atlas_model_forecast"][0]
        assert first_atlas["provenance"] == "atlas_model"


def test_model_metrics_endpoint():
    response = client.get("/api/model/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "scores" in data
    assert "lightgbm_model" in data["scores"]
    assert "baseline_24h_persistence" in data["scores"]
    assert data["scores"]["lightgbm_model"]["mae"] is not None
    assert "evaluation_verdict" in data
    assert "beats_24h_baseline" in data["evaluation_verdict"]


def test_anomalies_endpoint():
    response = client.get("/api/anomalies")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        anom = data[0]
        assert "measured_pm25" in anom
        assert "z_score" in anom
        assert "meteorological_context" in anom
        assert "editorial_narrative" in anom
