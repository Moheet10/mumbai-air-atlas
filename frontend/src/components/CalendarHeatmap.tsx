import React, { useState, useEffect, useMemo } from 'react';
import type { StationHistoryPoint, StationHistoryResponse } from '../types';
import { calculatePM25AQI } from '../lib/aqi';

interface CalendarHeatmapProps {
  stationId: string;
  stationName: string;
  apiBase?: string;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  stationId,
  stationName,
  apiBase = 'http://localhost:8000',
}) => {
  const [historyPoints, setHistoryPoints] = useState<StationHistoryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    hour: number;
    val: number | null;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/api/stations/${stationId}/history?days=60`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: StationHistoryResponse = await res.json();
        if (!isCancelled) {
          setHistoryPoints(data.points || []);
        }
      } catch (e) {
        console.warn('Failed to load station history for heatmap', e);
        if (!isCancelled) setHistoryPoints([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    if (stationId) {
      fetchHistory();
    }
    return () => {
      isCancelled = true;
    };
  }, [stationId, apiBase]);

  // Aggregate points into a lookup table: date -> hour -> pm2_5
  const { dates, matrix } = useMemo(() => {
    const map = new Map<string, (number | null)[]>();
    for (const pt of historyPoints) {
      if (!map.has(pt.date)) {
        map.set(pt.date, Array(24).fill(null));
      }
      const arr = map.get(pt.date)!;
      if (pt.hour >= 0 && pt.hour < 24) {
        arr[pt.hour] = pt.pm2_5;
      }
    }

    const sortedDates = Array.from(map.keys()).sort();
    return {
      dates: sortedDates,
      matrix: map,
    };
  }, [historyPoints]);

  const getColor = (val: number | null): string => {
    if (val === null || val === undefined) return 'var(--paper-2)';
    if (val <= 30) return 'var(--aqi-good)';
    if (val <= 60) return 'var(--aqi-sat)';
    if (val <= 90) return 'var(--aqi-mod)';
    if (val <= 120) return 'var(--aqi-poor)';
    if (val <= 250) return 'var(--aqi-vpoor)';
    return 'var(--aqi-severe)';
  };

  return (
    <div style={{ position: 'relative', width: '100%', fontFamily: 'var(--font-mono)' }}>
      {/* Header & Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.08em', color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            CHRONOLOGICAL TOPOGRAPHY &middot; 60-DAY DIURNAL HEATMAP
          </div>
          <h4 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', fontWeight: 500, margin: '4px 0 0' }}>
            {stationName}: Hourly Particulate Matrix (00h&ndash;23h IST)
          </h4>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-2)' }}>
          {dates.length > 0 ? `${dates[0]} → ${dates[dates.length - 1]}` : 'Awaiting data...'} · 24h × {dates.length}d
        </div>
      </div>

      {loading && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: '12px', color: 'var(--ink-2)' }}>
          LOADING 60-DAY HOURLY ARCHIVE...
        </div>
      )}

      {!loading && dates.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: '12px', color: 'var(--ink-2)' }}>
          NO HISTORICAL RECORDS LOGGED FOR THIS STATION NODE.
        </div>
      )}

      {!loading && dates.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--rule)', padding: '16px', backgroundColor: 'var(--paper)' }}>
          {/* Heatmap Grid */}
          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            <div style={{ display: 'flex' }}>
              {/* Y-axis labels (Hours 00, 04, 08, 12, 16, 20) */}
              <div style={{ width: '40px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '240px', paddingRight: '8px', textAlign: 'right', fontSize: '10px', color: 'var(--ink-2)' }}>
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>23:00</span>
              </div>

              {/* Matrix Columns */}
              <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                {dates.map((d) => {
                  const hours = matrix.get(d) || Array(24).fill(null);
                  return (
                    <div
                      key={d}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        flex: '1 1 0',
                        minWidth: '8px',
                        maxWidth: '16px',
                      }}
                    >
                      {hours.map((val, h) => {
                        const bg = getColor(val);
                        return (
                          <div
                            key={h}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredCell({
                                date: d,
                                hour: h,
                                val,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => setHoveredCell(null)}
                            style={{
                              height: '8px',
                              width: '100%',
                              backgroundColor: bg,
                              border: val === null ? '1px dotted var(--rule)' : 'none',
                              cursor: 'crosshair',
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis date labels */}
            <div style={{ display: 'flex', marginLeft: '40px', marginTop: '8px', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-2)' }}>
              <span>{dates[0]}</span>
              {dates.length > 20 && <span>{dates[Math.floor(dates.length / 2)]}</span>}
              <span>{dates[dates.length - 1]}</span>
            </div>
          </div>

          {/* CPCB Legend */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--rule)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '11px',
              color: 'var(--ink)',
            }}
          >
            <span style={{ color: 'var(--ink-2)', marginRight: '4px' }}>CPCB BREAKPOINTS:</span>
            {[
              { label: 'Good (0–30)', color: 'var(--aqi-good)' },
              { label: 'Satisfactory (31–60)', color: 'var(--aqi-sat)' },
              { label: 'Moderate (61–90)', color: 'var(--aqi-mod)' },
              { label: 'Poor (91–120)', color: 'var(--aqi-poor)' },
              { label: 'Very Poor (121–250)', color: 'var(--aqi-vpoor)' },
              { label: 'Severe (>250)', color: 'var(--aqi-severe)' },
            ].map((cat) => (
              <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', backgroundColor: cat.color, border: '1px solid var(--ink)' }} />
                <span>{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 12}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--ink)',
            padding: '6px 10px',
            fontSize: '11px',
            color: 'var(--ink)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            boxShadow: 'none',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {hoveredCell.date} &middot; {String(hoveredCell.hour).padStart(2, '0')}:00 IST
          </div>
          <div>
            PM2.5: {hoveredCell.val !== null ? `${hoveredCell.val.toFixed(1)} µg/m³` : 'N/A'}
            {hoveredCell.val !== null && (
              <span style={{ color: 'var(--ink-2)', marginLeft: '6px' }}>
                ({calculatePM25AQI(hoveredCell.val).category.label})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
