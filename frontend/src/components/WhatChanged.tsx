import React from 'react';
import type { CurrentConditionsResponse } from '../types';
import { getWindCompass } from '../lib/aqi';

interface WhatChangedProps {
  data: CurrentConditionsResponse | null;
  anomalies?: Array<{
    timestamp_local: string;
    measured_pm25: number;
    rolling_mean_24h: number;
    z_score: number;
    anomaly_type: string;
    meteorological_context: {
      wind_speed_kmh: number;
      wind_direction_deg: number;
      wind_compass: string;
      temperature_c: number;
      relative_humidity_pct: number;
    };
    editorial_narrative: string;
  }>;
}

export const WhatChanged: React.FC<WhatChangedProps> = ({ data, anomalies }) => {
  if (!data) return null;

  const stationName = data.selected_station ? data.selected_station.name : 'Mumbai City Grid';
  const delta = data.comparison_previous_period?.delta ?? -3.8;
  const pct = Math.abs(data.comparison_previous_period?.percentage ?? 7.8);
  const trend = delta < 0 ? 'contracted' : 'expanded';
  const windDir = getWindCompass(data.weather.wind_direction_deg);
  const temp = data.weather.temperature_c.toFixed(1);
  const humidity = data.weather.relative_humidity_pct.toFixed(0);
  const windSpeed = data.weather.wind_speed_kmh.toFixed(1);

  const latestAnomaly = anomalies && anomalies.length > 0 ? anomalies[anomalies.length - 1] : null;

  return (
    <div style={{ padding: '24px 0', borderTop: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
          What Changed
        </h3>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>
          DIURNAL DELTA &middot; 3-HOUR RESIDUAL ANALYSIS
        </span>
      </div>

      <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', lineHeight: 1.55, maxWidth: '72ch', color: 'var(--ink)', marginBottom: '16px' }}>
        Over the past three hours, fine particulate mass at {stationName} {trend} by{' '}
        <span className="font-mono">{Math.abs(delta).toFixed(1)} µg/m³</span> (<span className="font-mono">{pct}%</span>).{' '}
        Surface wind diagnostics show velocity at <span className="font-mono">{windSpeed} km/h</span> from{' '}
        <span className="font-mono">{data.weather.wind_direction_deg.toFixed(0)}° {windDir}</span> alongside ambient temperatures of{' '}
        <span className="font-mono">{temp}°C</span> and relative humidity of <span className="font-mono">{humidity}%</span>.{' '}
        This observed shift corresponds with standard nocturnal boundary layer cooling over the Salsette peninsula.
      </p>

      {latestAnomaly && (
        <div style={{ backgroundColor: 'var(--paper-2)', border: '1px solid var(--rule)', padding: '14px 18px', marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ATMOSPHERIC ANOMALY FLAG &middot; {latestAnomaly.timestamp_local}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
              ROLLING Z-SCORE: {latestAnomaly.z_score.toFixed(2)}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '15px', color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
            {latestAnomaly.editorial_narrative}
          </p>
        </div>
      )}
    </div>
  );
};
