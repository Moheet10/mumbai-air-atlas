import React, { useState } from 'react';
import type { TimelinePoint } from '../types';

interface ForecastChartProps {
  observations: TimelinePoint[];
  providerForecast: TimelinePoint[];
  atlasModelForecast?: TimelinePoint[];
  atlasModelLower?: TimelinePoint[];
  atlasModelUpper?: TimelinePoint[];
  textSummary: string;
  isStationMode?: boolean;
  stationReading?: number | null;
  stationName?: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  observations,
  providerForecast,
  atlasModelForecast,
  atlasModelLower,
  atlasModelUpper,
  textSummary,
  isStationMode = false,
  stationReading,
  stationName,
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
  if (atlasModelUpper) {
    values.push(...atlasModelUpper.map((p) => p.value ?? 0));
  }
  if (stationReading != null) {
    values.push(stationReading);
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
      const idx = obsCount === 0 ? i : obsCount - 1 + i;
      return `${i === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.value ?? 0)}`;
    })
    .join(' ');

  // Compute discrete station model forecast points at +1, +6, +12, +24, +48h
  const leadHours = [1, 6, 12, 24, 48];
  const stationPoints = (atlasModelForecast || []).map((pt, i) => {
    let matchIdx = allPoints.findIndex((p) => p.timestamp_utc === pt.timestamp_utc);
    if (matchIdx === -1) {
      const lh = leadHours[i] || (i + 1);
      matchIdx = obsCount === 0 ? Math.min(lh - 1, allPoints.length - 1) : Math.min(obsCount - 1 + lh, allPoints.length - 1);
    }
    const x = getX(matchIdx);
    const y = getY(pt.value ?? 0);
    const loVal = atlasModelLower && atlasModelLower[i] ? (atlasModelLower[i].value ?? pt.value ?? 0) : (pt.value ?? 0);
    const hiVal = atlasModelUpper && atlasModelUpper[i] ? (atlasModelUpper[i].value ?? pt.value ?? 0) : (pt.value ?? 0);
    const yLower = getY(loVal);
    const yUpper = getY(hiVal);
    const lh = leadHours[i] || (i + 1);

    return {
      x,
      y,
      yLower,
      yUpper,
      loVal,
      hiVal,
      leadHour: lh,
      point: pt,
    };
  });

  // Thin line connecting the 5 discrete forecast points (NO smoothing / interpolation)
  const stationLineD = stationPoints.length > 0
    ? stationPoints.map((sp, i) => `${i === 0 ? 'M' : 'L'} ${sp.x} ${sp.y}`).join(' ')
    : '';

  // 80% Prediction interval confidence envelope ribbon
  const ribbonD = stationPoints.length > 1
    ? [
        ...stationPoints.map((sp, i) => `${i === 0 ? 'M' : 'L'} ${sp.x} ${sp.yUpper}`),
        ...stationPoints.slice().reverse().map((sp) => `L ${sp.x} ${sp.yLower}`),
        'Z',
      ].join(' ')
    : '';

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100].filter((v) => v <= maxVal);
  if (!yTicks.includes(maxVal)) yTicks.push(maxVal);

  return (
    <div
      className="atlas-card"
      style={{
        position: 'relative',
        width: '100%',
        padding: '24px',
        backgroundColor: 'var(--paper-2)',
      }}
    >
      {/* Chart Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
            {isStationMode && stationName
              ? `${stationName.split(',')[0]} Forecast Horizon`
              : 'Station Forecast Horizon'}
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginTop: '3px', letterSpacing: '0.04em' }}>
            STATION MODEL FORECAST AT +1, +6, +12, +24, +48H &middot; 80% ERROR INTERVALS &middot; REGIONAL CAMS REFERENCE
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {stationReading != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#D32F2F', border: '1.5px solid var(--paper)' }} />
              <span style={{ color: '#D32F2F', fontWeight: 600 }}>STATION ({stationReading.toFixed(1)} µg/m³)</span>
            </div>
          )}
          {observations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '16px', height: '2px', backgroundColor: 'var(--ink)' }} />
              <span>OBSERVED</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '2px', borderTop: '2px dashed var(--ink-2)' }} />
            <span>CAMS GRID</span>
          </div>
          {stationPoints.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '16px', height: '2px', backgroundColor: 'var(--ink)' }} />
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', border: '1.5px solid var(--ink)', backgroundColor: 'var(--paper)', marginLeft: '-11px' }} />
              <span style={{ fontWeight: 600, color: 'var(--ink)', marginLeft: '5px' }}>FORECAST (+1h...48h)</span>
            </div>
          )}
          {stationPoints.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '10px', backgroundColor: 'var(--ink)', opacity: 0.12, borderRadius: '2px', border: '1px solid var(--rule)' }} />
              <span>80% INTERVAL (q10–q90)</span>
            </div>
          )}
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

          {/* Observed Line (Solid) - only drawn when observations exist */}
          {observations.length > 0 && obsPathD && (
            <path
              d={obsPathD}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

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

          {/* Station Model Forecast Ribbon (80% Prediction Interval Band) */}
          {ribbonD && (
            <path
              d={ribbonD}
              fill="var(--ink)"
              fillOpacity="0.08"
              stroke="none"
            />
          )}

          {/* Station Model Forecast Line (Thin connecting line, NO smoothing) */}
          {stationLineD && (
            <path
              d={stationLineD}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Station Model Discrete Points & Uncertainty Interval Bars */}
          {stationPoints.map((sp, idx) => (
            <g key={idx}>
              {/* Vertical interval error bar (q10 to q90) */}
              <line
                x1={sp.x}
                y1={sp.yUpper}
                x2={sp.x}
                y2={sp.yLower}
                stroke="var(--ink)"
                strokeWidth="1.4"
                opacity="0.75"
              />
              {/* Upper tick cap */}
              <line
                x1={sp.x - 4}
                y1={sp.yUpper}
                x2={sp.x + 4}
                y2={sp.yUpper}
                stroke="var(--ink)"
                strokeWidth="1.4"
                opacity="0.75"
              />
              {/* Lower tick cap */}
              <line
                x1={sp.x - 4}
                y1={sp.yLower}
                x2={sp.x + 4}
                y2={sp.yLower}
                stroke="var(--ink)"
                strokeWidth="1.4"
                opacity="0.75"
              />
              {/* Discrete forecast point dot */}
              <circle
                cx={sp.x}
                cy={sp.y}
                r="3.5"
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth="2"
              />
              {/* Lead hour badge with background pill */}
              <rect
                x={sp.x - 14}
                y={sp.yUpper - 18}
                width="28"
                height="14"
                rx="3"
                fill="var(--paper-2)"
                stroke="var(--rule)"
                strokeWidth="1"
              />
              <text
                x={sp.x}
                y={sp.yUpper - 8}
                textAnchor="middle"
                className="font-mono"
                fontSize="9"
                fontWeight="600"
                fill="var(--ink)"
              >
                +{sp.leadHour}h
              </text>
            </g>
          ))}

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

          {/* Selected Physical Station Reading (Plotted at NOW) */}
          {stationReading != null && (
            <g>
              <circle
                cx={nowX}
                cy={getY(stationReading)}
                r="5.5"
                fill="#D32F2F"
                stroke="var(--paper)"
                strokeWidth="2"
              />
              <circle
                cx={nowX}
                cy={getY(stationReading)}
                r="9"
                fill="none"
                stroke="#D32F2F"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              {nowX > paddingLeft + 120 ? (
                <g>
                  <rect
                    x={nowX - 145}
                    y={getY(stationReading) - 10}
                    width="135"
                    height="20"
                    rx="3"
                    fill="var(--paper)"
                    stroke="#D32F2F"
                    strokeWidth="1"
                  />
                  <text
                    x={nowX - 8}
                    y={getY(stationReading) + 4}
                    textAnchor="end"
                    className="font-mono"
                    fontSize="10"
                    fontWeight="700"
                    fill="#D32F2F"
                  >
                    {stationReading.toFixed(1)} µg/m³ (Station)
                  </text>
                </g>
              ) : (
                <text
                  x={nowX + 12}
                  y={getY(stationReading) + 4}
                  className="font-mono"
                  fontSize="10"
                  fontWeight="700"
                  fill="#D32F2F"
                >
                  {stationReading.toFixed(1)} µg/m³
                </text>
              )}
            </g>
          )}

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

          {/* Interactive hover targets for station forecast points */}
          {stationPoints.map((sp, idx) => (
            <circle
              key={`st-hover-${idx}`}
              cx={sp.x}
              cy={sp.y}
              r="8"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() =>
                setHoveredPoint({
                  x: sp.x,
                  y: sp.y,
                  point: sp.point,
                  type: `Station Model (+${sp.leadHour}h [q10: ${sp.loVal.toFixed(1)}, q90: ${sp.hiVal.toFixed(1)}])`,
                })
              }
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

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

      {/* Observation availability notice */}
      {observations.length === 0 && (
        <div style={{ marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)' }}>
          Historical station sensor telemetry pending; displaying regional CAMS grid forecast and discrete station model points (+1, +6, +12, +24, +48h).
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
