import React, { useState } from 'react';
import type { CurrentConditionsResponse } from '../types';
import { getWindCompass } from '../lib/aqi';
import { SpotlightCard } from './SpotlightCard';
import { TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

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
    <div style={{ padding: '32px 0 20px', borderTop: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
            What Changed
          </h3>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', letterSpacing: '0.04em' }}>
            DIURNAL DELTA &middot; 3-HOUR RESIDUAL ANALYSIS
          </span>
        </div>

        {/* Trend Pill */}
        <div
          className="atlas-pill"
          style={{
            backgroundColor: delta < 0 ? 'rgba(76, 140, 107, 0.12)' : 'rgba(217, 119, 43, 0.12)',
            borderColor: delta < 0 ? 'var(--aqi-good)' : 'var(--aqi-poor)',
            color: delta < 0 ? 'var(--aqi-good)' : 'var(--aqi-poor)',
            fontWeight: 600,
          }}
        >
          {delta < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
          <span>
            {delta < 0 ? '' : '+'}
            {delta.toFixed(1)} µg/m³ ({pct}%) 3h delta
          </span>
        </div>
      </div>

      <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '19px', lineHeight: 1.55, maxWidth: '72ch', color: 'var(--ink)', marginBottom: '20px' }}>
        Over the past three hours, fine particulate mass at {stationName} {trend} by{' '}
        <strong className="font-mono">{Math.abs(delta).toFixed(1)} µg/m³</strong> (<span className="font-mono">{pct}%</span>).{' '}
        Surface wind diagnostics show velocity at <strong className="font-mono">{windSpeed} km/h</strong> from{' '}
        <strong className="font-mono">{data.weather.wind_direction_deg.toFixed(0)}° {windDir}</strong> alongside ambient temperatures of{' '}
        <strong className="font-mono">{temp}°C</strong> and relative humidity of <strong className="font-mono">{humidity}%</strong>.
      </p>

      {anomalies && anomalies.length > 0 && activeAnomaly && (
        <SpotlightCard
          style={{
            backgroundColor: 'var(--paper-2)',
            padding: '20px 24px',
            marginTop: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} style={{ color: 'var(--aqi-poor)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                HISTORICAL ANOMALY ARCHIVE &middot; {activeAnomaly.timestamp_local}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
              ROLLING Z-SCORE: <strong style={{ color: 'var(--ink)' }}>{activeAnomaly.z_score.toFixed(2)}</strong>
            </span>
          </div>

          <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '17px', color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 14px' }}>
            {activeAnomaly.editorial_narrative}
          </p>

          {/* Anomaly Event Browser */}
          <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SELECT EVENT:
            </span>
            {anomalies.slice(-5).map((a, i) => {
              const realIndex = anomalies.length - 5 + i;
              const isSelected = realIndex === selectedIdx;
              return (
                <button
                  key={a.timestamp_local}
                  onClick={() => setSelectedIdx(realIndex)}
                  className={`atlas-pill ${isSelected ? 'active' : ''}`}
                  style={{
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {a.timestamp_local.split(' ')[0]} (z={a.z_score.toFixed(1)})
                </button>
              );
            })}
          </div>
        </SpotlightCard>
      )}
    </div>
  );
};
