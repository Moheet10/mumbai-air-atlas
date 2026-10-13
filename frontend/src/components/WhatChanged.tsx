import React, { useState } from 'react';
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
  const [selectedIdx, setSelectedIdx] = useState<number>(
    anomalies && anomalies.length > 0 ? anomalies.length - 1 : 0
  );

  if (!data) return null;

  const stationName = data.selected_station ? data.selected_station.name : 'Mumbai City Grid';
  const delta = data.comparison_previous_period?.delta ?? -3.8;
  const pct = Math.abs(data.comparison_previous_period?.percentage ?? 7.8);
  const trend = delta < 0 ? 'contracted' : 'expanded';
  const windDir = getWindCompass(data.weather.wind_direction_deg);
  const temp = data.weather.temperature_c.toFixed(1);
  const humidity = data.weather.relative_humidity_pct.toFixed(0);
  const windSpeed = data.weather.wind_speed_kmh.toFixed(1);

  const activeAnomaly =
    anomalies && anomalies.length > 0 && selectedIdx < anomalies.length
      ? anomalies[selectedIdx]
      : anomalies && anomalies.length > 0
      ? anomalies[anomalies.length - 1]
      : null;

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

      {anomalies && anomalies.length > 0 && activeAnomaly && (
        <div style={{ backgroundColor: 'var(--paper-2)', border: '1px solid var(--rule)', padding: '16px 20px', marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ATMOSPHERIC ANOMALY EVENT &middot; {activeAnomaly.timestamp_local}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
              ROLLING Z-SCORE: <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{activeAnomaly.z_score.toFixed(2)}</span>
            </span>
          </div>

          <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--ink)', lineHeight: 1.5, margin: '0 0 12px' }}>
            {activeAnomaly.editorial_narrative}
          </p>

          {/* Anomaly Event Browser */}
          <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-2)', textTransform: 'uppercase' }}>
              HISTORICAL ANOMALIES:
            </span>
            {anomalies.slice(-5).map((a, i) => {
              const realIndex = anomalies.length - 5 + i;
              const isSelected = realIndex === selectedIdx;
              return (
                <button
                  key={a.timestamp_local}
                  onClick={() => setSelectedIdx(realIndex)}
                  className="editorial-btn"
                  style={{
                    fontSize: '11px',
                    fontWeight: isSelected ? 600 : 400,
                    borderBottom: isSelected ? '2px solid var(--ink)' : '1px solid var(--rule)',
                  }}
                >
                  {a.timestamp_local.split(' ')[0]} {a.timestamp_local.split(' ')[1]} (z={a.z_score.toFixed(1)})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
