import React from 'react';
import type { Station } from '../types';
import { calculatePM25AQI } from '../lib/aqi';

interface StationListProps {
  stations: Station[];
  selectedStationId?: string;
  onSelectStation: (stationId: string) => void;
}

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
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>STATION / LOCATION</span>
        <span>PM2.5 / CATEGORY</span>
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
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              outline: 'none',
              transition: 'background-color 150ms ease',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: '17px',
                  fontWeight: isSelected ? 600 : 500,
                  color: 'var(--ink)',
                  lineHeight: 1.2,
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

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
