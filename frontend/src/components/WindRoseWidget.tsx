import React from 'react';
import { getWindCompass } from '../lib/aqi';

interface WindRoseWidgetProps {
  speedKmh: number;
  directionDeg: number;
  className?: string;
}

export const WindRoseWidget: React.FC<WindRoseWidgetProps> = ({
  speedKmh,
  directionDeg,
  className = '',
}) => {
  const compassDir = getWindCompass(directionDeg);

  // Beaufort scale approximation
  const getBeaufort = (speed: number) => {
    if (speed < 1) return 'Calm';
    if (speed <= 5) return 'Light Air';
    if (speed <= 11) return 'Light Breeze';
    if (speed <= 19) return 'Gentle Breeze';
    if (speed <= 28) return 'Moderate Breeze';
    if (speed <= 38) return 'Fresh Breeze';
    return 'Strong Wind';
  };

  const beaufort = getBeaufort(speedKmh);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '8px 12px',
        backgroundColor: 'var(--paper)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-sm)',
      }}
      title={`Wind: ${speedKmh.toFixed(1)} km/h blowing from ${directionDeg}° (${compassDir}) · ${beaufort}`}
    >
      {/* Precision Compass Rose Dial */}
      <div
        style={{
          position: 'relative',
          width: '46px',
          height: '46px',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 46 46"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Outer dial ring */}
          <circle
            cx="23"
            cy="23"
            r="21"
            fill="none"
            stroke="var(--rule)"
            strokeWidth="1"
          />

          {/* Compass 8 Cardinal Ticks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const isCardinal = deg % 90 === 0;
            const len = isCardinal ? 3.5 : 2;
            const x1 = 23 + Math.cos(rad) * (21 - len);
            const y1 = 23 + Math.sin(rad) * (21 - len);
            const x2 = 23 + Math.cos(rad) * 21;
            const y2 = 23 + Math.sin(rad) * 21;
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isCardinal ? 'var(--ink)' : 'var(--ink-2)'}
                strokeWidth={isCardinal ? 1.2 : 0.8}
                opacity={isCardinal ? 0.8 : 0.5}
              />
            );
          })}

          {/* North indicator mark */}
          <text
            x="23"
            y="7"
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="6px"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            N
          </text>
        </svg>

        {/* Dynamic Rotating Compass Needle */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${directionDeg}deg)`,
            transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <svg
            viewBox="0 0 46 46"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            {/* Red tip (North / pointing towards wind source) */}
            <polygon
              points="23,8 20,23 26,23"
              fill="#D32F2F"
              opacity="0.9"
            />
            {/* Counter feather tip */}
            <polygon
              points="23,38 20,23 26,23"
              fill="var(--ink)"
              opacity="0.3"
            />
            {/* Center Pivot Pin */}
            <circle cx="23" cy="23" r="2.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Numerical Direction and Speed Readout */}
      <div style={{ minWidth: 0, fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
            {speedKmh.toFixed(1)} <span style={{ fontSize: '10px', color: 'var(--ink-2)' }}>km/h</span>
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--ink)',
              padding: '1px 5px',
              backgroundColor: 'var(--paper-2)',
              borderRadius: '2px',
              border: '1px solid var(--rule)',
            }}
          >
            {compassDir}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--ink-2)', marginTop: '2px' }}>
          {directionDeg.toFixed(0)}° &middot; {beaufort}
        </div>
      </div>
    </div>
  );
};

export default WindRoseWidget;
