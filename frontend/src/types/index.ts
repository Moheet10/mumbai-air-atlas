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
  status: 'active' | 'stale' | 'sample' | 'offline' | 'snapshot';
  latest_pm25: number | null;
  latest_pm10: number | null;
  latest_timestamp: string | null;
  provenance: ProvenanceType;
  is_sample: boolean;
  sparkline_7d?: number[];
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
  data_mode?: 'live' | 'snapshot' | 'sample';
  snapshot_as_of?: string;
  comparison_previous_period?: {
    previous_value: number;
    delta: number;
    percentage: number;
    period: string;
    trend: 'falling' | 'rising';
  };
  other_pollutants: PollutantReading[];
  weather: WeatherContext;
  openaq_status: 'connected' | 'missing_key' | 'rate_limited' | 'error' | 'snapshot';
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
  data_mode?: 'live' | 'snapshot' | 'sample';
  snapshot_as_of?: string;
  db_stale?: boolean;
  db_age_hours?: number;
  observations: TimelinePoint[];
  provider_forecast: TimelinePoint[];
  atlas_model_forecast?: TimelinePoint[];
  atlas_model_lower?: TimelinePoint[];
  atlas_model_upper?: TimelinePoint[];
  text_summary: string;
  provider_model_name: string;
  generated_at: string;
}

export interface StationHistoryPoint {
  timestamp_utc: string;
  timestamp_local: string;
  date: string;
  hour: number;
  pm2_5: number;
}

export interface StationHistoryResponse {
  station_id: string;
  days: number;
  count: number;
  points: StationHistoryPoint[];
}

export interface HorizonScore {
  lead_hours: number;
  horizon_label: string;
  baseline_mae: number;
  baseline_rmse?: number;
  baseline_7d_diurnal_mae?: number;
  baseline_blended_mae?: number;
  model_mae: number;
  model_rmse?: number;
  delta_mae: number;
  improvement_pct: number;
  bootstrap_95_ci: [number, number];
  ci_vs_7d_diurnal?: [number, number];
  beats_baseline: boolean;
  test_hours?: number;
  unit: string;
}

export interface SeasonalFoldHorizon {
  lead_hours: number;
  test_hours: number;
  mean_pm25: number;
  mae_model: number;
  mae_persistence: number;
  mae_blended: number;
  best_baseline: string;
  best_baseline_mae: number;
  delta_vs_best_baseline: number;
  skill_pct_vs_best_baseline: number;
  ci_95_model_minus_best_baseline: [number, number];
  winner: string;
}

export interface SeasonalFoldData {
  name: string;
  season_type: string;
  test_start: string;
  test_end: string;
  horizons: Record<string, SeasonalFoldHorizon>;
}

export interface WeatherAblationData {
  lead_hours: number;
  mae_full_features: number;
  mae_lags_plus_hour: number;
  mae_lags_only: number;
  gain_from_weather: number;
  gain_from_hour: number;
}

export interface GainImportanceModel {
  lead_hours: number;
  total_gain: number;
  groups: {
    lag: { total_gain: number; pct_share: number };
    hour: { total_gain: number; pct_share: number };
    weather: { total_gain: number; pct_share: number };
  };
  individual_features: Record<string, { gain: number; pct_share: number }>;
}

export interface PooledForwardChainingRow {
  lead_hours: number;
  n_samples: number;
  mae_model: number;
  mae_persistence: number;
  mae_blend: number;
  mae_cams_bias: number;
  coverage_overall_pct: number;
  top_decile_n: number;
  top_decile_mae_model: number;
  top_decile_mae_persistence: number;
  top_decile_mae_blend: number;
  top_decile_mae_cams_bias: number;
  top_decile_coverage_pct: number;
}

export interface SpatialHoldoutRow {
  lead_hours: number;
  held_out_sites: string[];
  n_samples: number;
  mae_model: number;
  mae_without_cams: number;
  mae_persistence: number;
  mae_blend: number;
  mae_cams_bias: number;
  best_baseline: string;
  diff_vs_best_baseline: number;
  ci_95_diff: [number, number];
  coverage_overall_pct: number;
  top_decile_mae_model: number;
  top_decile_mae_persistence: number;
  top_decile_mae_blend: number;
  top_decile_mae_cams_bias: number;
  top_decile_coverage_pct: number;
}

export interface ModelMetricsData {
  status?: string;
  model_name?: string;
  model_type?: string;
  algorithm?: string;
  split_method?: string;
  target_variable?: string;
  train_observations?: number;
  test_observations?: number;
  test_period_start?: string;
  test_period_end?: string;
  execution_timestamp_utc?: string;
  n_stations?: number;
  site_groups?: string[];
  pooled_forward_chaining?: PooledForwardChainingRow[];
  spatial_holdout?: SpatialHoldoutRow[];
  horizons?: Record<string, HorizonScore>;
  seasonal_folds?: Record<string, SeasonalFoldData>;
  weather_ablation?: Record<string, WeatherAblationData>;
  gain_importance?: Record<string, GainImportanceModel>;
  live_record?: any;
  scores?: {
    lightgbm_model?: { mae: number; rmse: number };
    baseline_24h_persistence?: { mae: number; rmse: number };
    baseline_1h_persistence?: { mae: number; rmse: number };
  };
  evaluation_verdict?: {
    beats_24h_baseline?: boolean;
    beats_1h_baseline?: boolean;
    beats_persistence?: boolean;
    honest_statement: string;
  };
  top_features?: Array<{ feature: string; importance: number }>;
}


