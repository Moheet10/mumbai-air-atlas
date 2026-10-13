export type ProvenanceType =
  | 'observed'
  | 'provider_forecast'
  | 'atlas_model'
  | 'observed_sample';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PollutantReading {
  parameter: string;
  display_name: string;
  value: number | null;
  unit: string;
  timestamp_utc: string;
  timestamp_local: string;
  provenance: ProvenanceType;
  source_name: string;
  is_sample: boolean;
}

export interface Station {
  id: string;
  name: string;
  area: string;
  agency: string;
  coordinates: Coordinates;
  status: 'active' | 'stale' | 'sample' | 'offline';
  latest_pm25: number | null;
  latest_pm10: number | null;
  latest_timestamp: string | null;
  provenance: ProvenanceType;
  is_sample: boolean;
}

export interface WeatherContext {
  temperature_c: number;
  relative_humidity_pct: number;
  apparent_temperature_c?: number;
  precipitation_mm: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  weather_code: number;
  condition_label: string;
  timestamp: string;
  source_name: string;
}

export interface CurrentConditionsResponse {
  location_name: string;
  coordinates: Coordinates;
  primary_pm25: PollutantReading;
  comparison_previous_period?: {
    previous_value: number;
    delta: number;
    percentage: number;
    period: string;
    trend: 'falling' | 'rising';
  };
  other_pollutants: PollutantReading[];
  weather: WeatherContext;
  openaq_status: 'connected' | 'missing_key' | 'rate_limited' | 'error';
  openaq_message: string;
  selected_station?: Station;
  generated_at: string;
}

export interface TimelinePoint {
  timestamp_utc: string;
  timestamp_local: string;
  value: number | null;
  unit: string;
  provenance: ProvenanceType;
  source_name: string;
}

export interface ForecastResponse {
  location_name: string;
  coordinates: Coordinates;
  station_id?: string;
  parameter: string;
  unit: string;
  observations: TimelinePoint[];
  provider_forecast: TimelinePoint[];
  atlas_model_forecast?: TimelinePoint[];
  text_summary: string;
  provider_model_name: string;
  generated_at: string;
}

export interface BaselineMetrics {
  target_variable: string;
  total_records: number;
  test_records: number;
  test_period_start: string;
  test_period_end: string;
  baseline_24h: {
    mae: number;
    rmse: number;
    unit: string;
  };
  baseline_1h: {
    mae: number;
    rmse: number;
    unit: string;
  };
}
