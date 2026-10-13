"""
Feature engineering module for Mumbai Air Atlas.
Transforms raw atmospheric observations and numerical weather features into
training matrices without future-information leakage.
"""

import numpy as np
import pandas as pd
from typing import List, Tuple


def build_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Constructs leak-free feature matrix from chronological time-series dataframe.
    Requires: timestamp_utc, timestamp_local, pm2_5, temperature_2m, relative_humidity_2m,
              precipitation, wind_speed_10m, wind_direction_10m.
    """
    df = df.copy()
    df["datetime"] = pd.to_datetime(df["timestamp_utc"])
    df = df.sort_values("datetime").reset_index(drop=True)

    # 1. Temporal cyclical features
    hour = df["datetime"].dt.hour
    day_of_week = df["datetime"].dt.dayofweek

    df["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    df["day_sin"] = np.sin(2 * np.pi * day_of_week / 7.0)
    df["day_cos"] = np.cos(2 * np.pi * day_of_week / 7.0)
    df["is_weekend"] = (day_of_week >= 5).astype(int)

    # 2. Meteorological transformations (coastal dynamics)
    # Wind vector decomposition into zonal (u: east-west) and meridional (v: north-south)
    wd_rad = np.radians(df["wind_direction_10m"].fillna(0))
    ws = df["wind_speed_10m"].fillna(0)
    df["wind_u"] = -ws * np.sin(wd_rad)  # Positive = Westerly (Sea breeze from Arabian Sea)
    df["wind_v"] = -ws * np.cos(wd_rad)  # Positive = Southerly

    # Estimated dew point depression: T - Td ~ (100 - RH) / 5
    # Small depression implies boundary-layer saturation and mist/haze
    temp = df["temperature_2m"].fillna(df["temperature_2m"].median())
    rh = df["relative_humidity_2m"].fillna(df["relative_humidity_2m"].median())
    df["dew_point_depression"] = np.maximum(0, (100 - rh) / 5.0)

    # Precipitation interaction
    df["precipitation"] = df["precipitation"].fillna(0)
    df["has_rain"] = (df["precipitation"] > 0.1).astype(int)

    # 3. Autoregressive lags (strictly backward)
    for lag in [1, 2, 3, 6, 12, 24]:
        df[f"pm2_5_lag_{lag}"] = df["pm2_5"].shift(lag)

    # 4. Rolling statistics (strictly backward looking using closed='left')
    df["pm2_5_roll_mean_6"] = df["pm2_5"].shift(1).rolling(window=6, min_periods=3).mean()
    df["pm2_5_roll_std_6"] = df["pm2_5"].shift(1).rolling(window=6, min_periods=3).std().fillna(0)
    df["pm2_5_roll_mean_24"] = df["pm2_5"].shift(1).rolling(window=24, min_periods=12).mean()

    # Weather rolling lags
    df["temp_lag_1"] = temp.shift(1)
    df["rh_lag_1"] = rh.shift(1)
    df["wind_speed_lag_1"] = ws.shift(1)

    feature_cols = [
        "hour_sin",
        "hour_cos",
        "day_sin",
        "day_cos",
        "is_weekend",
        "temperature_2m",
        "relative_humidity_2m",
        "dew_point_depression",
        "wind_speed_10m",
        "wind_u",
        "wind_v",
        "precipitation",
        "has_rain",
        "pm2_5_lag_1",
        "pm2_5_lag_2",
        "pm2_5_lag_3",
        "pm2_5_lag_6",
        "pm2_5_lag_12",
        "pm2_5_lag_24",
        "pm2_5_roll_mean_6",
        "pm2_5_roll_std_6",
        "pm2_5_roll_mean_24",
        "temp_lag_1",
        "rh_lag_1",
        "wind_speed_lag_1",
    ]

    return df, feature_cols
