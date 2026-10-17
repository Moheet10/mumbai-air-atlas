import React from 'react';
import type { Station } from '../types';
import { calculatePM25AQI } from '../lib/aqi';

interface StationListProps {
  stations: Station[];
  selectedStationId?: string;
  onSelectStation: (stationId: string) => void;
}

const Sparkline: React.FC<{ data?: number[] }> = ({ data }) => {
  if (!data || data.length < 2) {
    return <div style={{ width: '72px', height: '22px', borderBottom: '1px dotted var(--rule)' }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 72;
  const height = 22;
  const padding = 2;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
      title={`7-Day Trailing PM2.5: min ${min.toFixed(0)}, max ${max.toFixed(0)} µg/m³`}
    >
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          points={points}
        />
      </svg>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-2)' }}>
        7d
      </span>
    </div>
  );
};

export const StationList: React.FC<StationListProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        backgroundColor: 'var(--paper-2)',
        height: '420px',
        overflowY: 'auto',
      }}
      role="listbox"
      aria-label="Mumbai Air Quality Monitoring Stations"
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--rule)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--ink-2)',
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <span>STATION / LOCATION</span>
        <span style={{ textAlign: 'center' }}>7-DAY TRAILING</span>
        <span style={{ textAlign: 'right' }}>PM2.5 / CATEGORY</span>
      </div>

      {stations.map((s) => {
        const isSelected = s.id === selectedStationId;
        const pm25 = s.latest_pm25 ?? 40;
        const { aqi, category } = calculatePM25AQI(pm25);

        return (
          <div
            key={s.id}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => onSelectStation(s.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectStation(s.id);
              }
            }}
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--rule)',
              backgroundColor: isSelected ? 'var(--paper)' : 'transparent',
              borderLeft: isSelected ? '3px solid var(--ink)' : '3px solid transparent',
              cursor: 'pointer',
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: '16px',
              alignItems: 'center',
              outline: 'none',
              transition: 'background-color 150ms ease',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: '17px',
                  fontWeight: isSelected ? 600 : 500,
                  color: 'var(--ink)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--ink-2)',
                  marginTop: '2px',
                }}
              >
                {s.agency} &middot; {s.area}
              </div>
            </div>

            <Sparkline data={s.sparkline_7d} />

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  backgroundColor: category.colorHex,
                  border: '1px solid var(--ink)',
                }}
              />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>
                {pm25.toFixed(1)}{' '}
                <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--ink-2)' }}>
                  µg/m³ (AQI {aqi})
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
