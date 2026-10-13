import React, { useState } from 'react';
import type { TimelinePoint } from '../types';

interface ForecastChartProps {
  observations: TimelinePoint[];
  providerForecast: TimelinePoint[];
  atlasModelForecast?: TimelinePoint[];
  textSummary: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  observations,
  providerForecast,
  atlasModelForecast,
  textSummary,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    point: TimelinePoint;
    type: string;
  } | null>(null);

  // Combine timeline for coordinate scaling
  const allPoints = [
    ...observations.map((p) => ({ ...p, isFuture: false })),
    ...providerForecast.map((p) => ({ ...p, isFuture: true })),
  ];

  if (allPoints.length === 0) {
    return (
      <div style={{ padding: '32px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)' }}>
        AWAITING TIME-SERIES TELEMETRY...
      </div>
    );
  }

  // Dimensions
  const width = 800;
  const height = 280;
  const paddingLeft = 48;
  const paddingRight = 24;
  const paddingTop = 28;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute domain
  const values = allPoints.map((p) => p.value ?? 0);
  if (atlasModelForecast) {
    values.push(...atlasModelForecast.map((p) => p.value ?? 0));
  }
  const maxVal = Math.max(80, Math.ceil(Math.max(...values, 60) / 20) * 20);
  const minVal = 0;

  const getX = (index: number) => paddingLeft + (index / (allPoints.length - 1)) * chartWidth;
  const getY = (val: number) => paddingTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

  // Split into observed path and forecast path
  const obsCount = observations.length;
  const nowIndex = Math.max(0, obsCount - 1);
  const nowX = getX(nowIndex);

  // Generate SVG path for observations
  const obsPathD = observations
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.value ?? 0)}`)
    .join(' ');

  // Generate SVG path for provider forecast
  const fcPathD = providerForecast
    .map((p, i) => {
      const idx = obsCount - 1 + i;
      return `${i === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.value ?? 0)}`;
    })
    .join(' ');

  // Generate SVG path for Atlas model forecast (if available)
  const atlasPathD = atlasModelForecast
    ? atlasModelForecast
        .map((p, i) => {
          const idx = obsCount - 1 + i;
          return `${i === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.value ?? 0)}`;
        })
        .join(' ')
    : '';

  // Generate uncertainty band for provider forecast (+- 15% interval)
  const upperPoints = providerForecast.map((p, i) => {
    const idx = obsCount - 1 + i;
    const v = (p.value ?? 0) * 1.18;
    return `${getX(idx)},${getY(v)}`;
  });
  const lowerPoints = providerForecast
    .slice()
    .reverse()
    .map((p, i) => {
      const idx = obsCount - 1 + (providerForecast.length - 1 - i);
      const v = Math.max(0, (p.value ?? 0) * 0.82);
      return `${getX(idx)},${getY(v)}`;
    });
  const uncertaintyD = `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100].filter((v) => v <= maxVal);
  if (!yTicks.includes(maxVal)) yTicks.push(maxVal);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Chart Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
            48-Hour Particulate Horizon
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)', marginTop: '2px' }}>
            PM2.5 CONCENTRATION (µg/m³) &middot; SOLID: OBSERVED &middot; DASHED: CAMS GRID &middot; DOTTED: ATLAS MODEL
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '18px', height: '2px', backgroundColor: 'var(--ink)' }} />
            <span>OBSERVED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '18px', height: '2px', borderTop: '2px dashed var(--ink)' }} />
            <span>CAMS FORECAST</span>
          </div>
          {atlasModelForecast && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '18px', height: '2px', borderTop: '2px dotted var(--ink)' }} />
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>ATLAS MODEL</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '8px', backgroundColor: 'rgba(27, 26, 23, 0.12)' }} />
            <span>UNCERTAINTY BAND</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {/* Grid lines and Y-axis labels */}
          {yTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--rule)"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono"
                  fontSize="10"
                  fill="var(--ink-2)"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Uncertainty Band */}
          <path d={uncertaintyD} fill="rgba(27, 26, 23, 0.12)" />

          {/* Observed Line (Solid) */}
          <path
            d={obsPathD}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Provider Forecast Line (Dashed) */}
          <path
            d={fcPathD}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Atlas Model Forecast Line (Dotted) */}
          {atlasPathD && (
            <path
              d={atlasPathD}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2"
              strokeDasharray="2 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* "NOW" Vertical Hairline Rule */}
          <line
            x1={nowX}
            y1={paddingTop - 6}
            x2={nowX}
            y2={height - paddingBottom}
            stroke="var(--ink)"
            strokeWidth="1"
          />
          <text
            x={nowX}
            y={paddingTop - 10}
            textAnchor="middle"
            className="font-mono"
            fontSize="10"
            fill="var(--ink)"
            fontWeight="600"
          >
            NOW
          </text>

          {/* X-axis tick labels */}
          {allPoints.map((p, idx) => {
            if (idx % 12 !== 0 && idx !== allPoints.length - 1) return null;
            const x = getX(idx);
            if (Math.abs(x - nowX) < 35 && idx !== nowIndex) return null;

            return (
              <text
                key={idx}
                x={x}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                className="font-mono"
                fontSize="9"
                fill="var(--ink-2)"
              >
                {p.timestamp_local}
              </text>
            );
          })}

          {/* Interactive hover targets */}
          {allPoints.map((p, idx) => {
            const x = getX(idx);
            const y = getY(p.value ?? 0);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="6"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() =>
                  setHoveredPoint({
                    x,
                    y,
                    point: p,
                    type: idx < obsCount ? 'Observed' : 'CAMS Forecast',
                  })
                }
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {hoveredPoint && (
            <g pointerEvents="none">
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4"
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--ink)',
            padding: '6px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--ink)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {hoveredPoint.point.value?.toFixed(1)} µg/m³ &middot; {hoveredPoint.type.toUpperCase()}
          </div>
          <div style={{ color: 'var(--ink-2)' }}>
            {hoveredPoint.point.timestamp_local} &middot; {hoveredPoint.point.source_name}
          </div>
        </div>
      )}

      {/* Editorial Text Summary */}
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--rule)', paddingTop: '12px' }}>
        <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', lineHeight: 1.5, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          &ldquo;{textSummary}&rdquo;
        </p>
      </div>
    </div>
  );
};
