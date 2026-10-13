import pytest
import numpy as np
import pandas as pd
from backend.ml.features import build_features
from backend.ml.anomalies import detect_anomalies


def test_build_features_columns_and_shapes():
    # Synthetic test series
    times = pd.date_range("2026-10-01 00:00", periods=48, freq="h")
    df = pd.DataFrame({
        "timestamp_utc": [t.isoformat() for t in times],
        "timestamp_local": [t.strftime("%Y-%m-%d %H:%M") for t in times],
        "pm2_5": np.random.uniform(20, 80, size=48),
        "temperature_2m": np.random.uniform(25, 35, size=48),
        "relative_humidity_2m": np.random.uniform(40, 90, size=48),
        "precipitation": np.zeros(48),
        "wind_speed_10m": np.random.uniform(5, 20, size=48),
        "wind_direction_10m": np.random.uniform(0, 360, size=48),
    })

    feat_df, cols = build_features(df)
    assert len(cols) > 20
    assert "wind_u" in cols
    assert "wind_v" in cols
    assert "dew_point_depression" in cols
    assert "pm2_5_lag_1" in cols
    assert "pm2_5_lag_24" in cols
    assert "hour_sin" in cols


def test_wind_vector_physics():
    times = pd.date_range("2026-10-01 00:00", periods=2, freq="h")
    # West wind (270 deg) should yield positive u (onshore sea breeze)
    df = pd.DataFrame({
        "timestamp_utc": [t.isoformat() for t in times],
        "timestamp_local": [t.strftime("%Y-%m-%d %H:%M") for t in times],
        "pm2_5": [50.0, 52.0],
        "temperature_2m": [30.0, 31.0],
        "relative_humidity_2m": [60.0, 62.0],
        "precipitation": [0.0, 0.0],
        "wind_speed_10m": [10.0, 10.0],
        "wind_direction_10m": [270.0, 90.0],  # West then East
    })
    feat_df, _ = build_features(df)
    # Wind from West (270) has u > 0
    assert feat_df["wind_u"].iloc[0] > 9.0
    # Wind from East (90) has u < 0
    assert feat_df["wind_u"].iloc[1] < -9.0


def test_anomaly_detection_execution():
    anomalies = detect_anomalies(z_threshold=1.5)
    assert isinstance(anomalies, list)
    if len(anomalies) > 0:
        first = anomalies[0]
        assert "measured_pm25" in first
        assert "z_score" in first
        assert "editorial_narrative" in first
        assert "meteorological_context" in first
