import React, { useState, useEffect } from 'react';
import { Masthead } from './components/Masthead';
import { HeroAQI } from './components/HeroAQI';
import { StationMap } from './components/StationMap';
import { StationList } from './components/StationList';
import { ForecastChart } from './components/ForecastChart';
import { WhatChanged } from './components/WhatChanged';
import { ModelHonestyBox } from './components/ModelHonestyBox';
import { CalendarHeatmap } from './components/CalendarHeatmap';
import { DataFreshness } from './components/DataFreshness';
import { FadeContent } from './components/FadeContent';
import { Footer } from './components/Footer';
import type { CurrentConditionsResponse, ForecastResponse, Station } from './types';
import { getWindCompass } from './lib/aqi';
import './styles/design-tokens.css';

const API_BASE = '';

export const App: React.FC = () => {
  const [currentData, setCurrentData] = useState<CurrentConditionsResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [modelMetrics, setModelMetrics] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('mpcb-bkc');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFreshnessOpen, setIsFreshnessOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Theme state: defaults to prefers-color-scheme, persisted in localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mumbai-air-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mumbai-air-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('mumbai-air-theme');
      if (!saved) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Fetch initial stations and current conditions
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        // 1. Fetch stations
        const stRes = await fetch(`${API_BASE}/api/stations`);
        if (!stRes.ok) throw new Error(`HTTP ${stRes.status}`);
        const stData = await stRes.json();
        const stationList: Station[] = stData.stations || [];
        setStations(stationList);

        // Pick default station from live list (first active station, e.g. Bandra Kurla Complex)
        const initialStationId = stationList.length > 0 ? stationList[0].id : selectedStationId;
        setSelectedStationId(initialStationId);

        // 2. Fetch current conditions and forecast in parallel for default station
        const [curRes, fcRes] = await Promise.all([
          fetch(`${API_BASE}/api/current?station_id=${initialStationId}`),
          fetch(`${API_BASE}/api/forecast?station_id=${initialStationId}`),
        ]);
        if (!curRes.ok) throw new Error(`HTTP ${curRes.status}`);
        const curData = await curRes.json();
        setCurrentData(curData);

        if (fcRes.ok) {
          const fcData = await fcRes.json();
          setForecastData(fcData);
        }

        // 4. Fetch model metrics & anomalies
        try {
          const [mRes, aRes] = await Promise.all([
            fetch(`${API_BASE}/api/model/metrics`),
            fetch(`${API_BASE}/api/anomalies`),
          ]);
          if (mRes.ok) setModelMetrics(await mRes.json());
          if (aRes.ok) setAnomalies(await aRes.json());
        } catch (e) {
          console.warn('Metrics or anomaly endpoint error', e);
        }

        setError(null);
      } catch (err: any) {
        console.warn('API error, using local fallback:', err);
        setError('Connected in offline mode. Live backend not reached.');
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, []);

  // Handle station selection
  const handleSelectStation = async (stationId: string) => {
    setSelectedStationId(stationId);
    try {
      const [curRes, fcRes] = await Promise.all([
        fetch(`${API_BASE}/api/current?station_id=${stationId}`),
        fetch(`${API_BASE}/api/forecast?station_id=${stationId}`),
      ]);
      if (curRes.ok) {
        const cur = await curRes.json();
        setCurrentData(cur);
      }
      if (fcRes.ok) {
        const fc = await fcRes.json();
        setForecastData(fc);
      }
    } catch (e) {
      console.error('Failed to update station telemetry', e);
    }
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId) || stations[0];
  const isSnapshot = currentData?.data_mode === 'snapshot';
  const isSample = currentData?.data_mode === 'sample';
  const snapshotDate = currentData?.snapshot_as_of || '14 Oct 2026';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Persistent Snapshot Banner */}
      {isSnapshot && (
        <div
          style={{
            backgroundColor: 'var(--paper-2)',
            borderBottom: '1px solid var(--rule)',
            padding: '6px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.06em',
            textAlign: 'center',
            color: 'var(--ink)',
          }}
        >
          SNAPSHOT: data as of {snapshotDate}, not live
        </div>
      )}

      {/* Persistent DEMO DATA banner when running in sample mode */}
      {isSample && (
        <div
          style={{
            backgroundColor: 'var(--paper-2)',
            borderBottom: '1px solid var(--rule)',
            padding: '6px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.06em',
            textAlign: 'center',
            color: 'var(--ink)',
          }}
        >
          DEMO DATA &mdash; not live station readings
        </div>
      )}

      <Masthead
        lastUpdated={currentData?.generated_at}
        openaqStatus={currentData?.openaq_status}
        onOpenFreshness={() => setIsFreshnessOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <DataFreshness
        isOpen={isFreshnessOpen}
        onClose={() => setIsFreshnessOpen(false)}
        openaqStatus={currentData?.openaq_status}
        lastUpdated={currentData?.generated_at}
      />

      <main style={{ flex: 1 }}>
        {/* Error notification banner if backend offline */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--paper-2)',
              borderBottom: '1px solid var(--rule)',
              padding: '8px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--ink-2)',
              textAlign: 'center',
            }}
          >
            SYSTEM TELEMETRY: {error} &mdash; ENSURE FASTAPI RUNS ON PORT 8000
          </div>
        )}

        {/* 1. Hero AQI Section */}
        <HeroAQI data={currentData} loading={loading} />

        {/* 2. Main Asymmetrical Stage: Map & Station Detail */}
        <section style={{ padding: '48px 0 32px' }}>
          <div className="container">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '32px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Map or Directory List Toggle */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
                    Monitoring Topography
                  </h3>

                  {/* View Mode Toggle */}
                  <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    <button
                      onClick={() => setViewMode('map')}
                      className="editorial-btn"
                      style={{
                        fontWeight: viewMode === 'map' ? 600 : 400,
                        borderBottom: viewMode === 'map' ? '2px solid var(--ink)' : '1px solid var(--rule)',
                      }}
                    >
                      MAP VIEW
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className="editorial-btn"
                      style={{
                        fontWeight: viewMode === 'list' ? 600 : 400,
                        borderBottom: viewMode === 'list' ? '2px solid var(--ink)' : '1px solid var(--rule)',
                      }}
                    >
                      DIRECTORY ({stations.length})
                    </button>
                  </div>
                </div>

                <div style={{ border: '1px solid var(--rule)', height: '420px', width: '100%' }}>
                  {viewMode === 'map' ? (
                    <StationMap
                      stations={stations}
                      selectedStationId={selectedStationId}
                      onSelectStation={handleSelectStation}
                      theme={theme}
                      isSample={isSample}
                    />
                  ) : (
                    <StationList
                      stations={stations}
                      selectedStationId={selectedStationId}
                      onSelectStation={handleSelectStation}
                    />
                  )}
                </div>

                {/* Station Quick Selector Bar */}
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {stations.slice(0, 5).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStation(s.id)}
                      className="editorial-btn"
                      style={{
                        fontWeight: s.id === selectedStationId ? 600 : 400,
                        borderBottom: s.id === selectedStationId ? '2px solid var(--ink)' : '1px solid var(--rule)',
                      }}
                    >
                      {s.area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Station Detail & Diagnostic Metrics */}
              <div className="station-detail-col" style={{ minWidth: 0 }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isSnapshot ? 'ARCHIVED CAAQMS STATION' : isSample ? 'SELECTED MONITORING NODE' : 'SELECTED FIELD INSTRUMENT'}
                  </div>
                  <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-editorial)', margin: '4px 0 6px' }}>
                    {selectedStation?.name || 'Monitoring Station'}
                  </h2>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)' }}>
                    {selectedStation?.agency} &middot; {selectedStation?.coordinates.latitude.toFixed(4)}°N,{' '}
                    {selectedStation?.coordinates.longitude.toFixed(4)}°E
                  </div>
                </div>

                {/* Surface Meteorology Summary */}
                {currentData && (
                  <div style={{ marginBottom: '24px', backgroundColor: 'var(--paper-2)', padding: '16px', border: '1px solid var(--rule)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      SURFACE METEOROLOGY (OPEN-METEO)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontFamily: 'var(--font-mono)' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--ink-2)' }}>TEMP</div>
                        <div style={{ fontSize: '18px', fontWeight: 600 }}>{currentData.weather.temperature_c.toFixed(1)}°C</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--ink-2)' }}>HUMIDITY</div>
                        <div style={{ fontSize: '18px', fontWeight: 600 }}>{currentData.weather.relative_humidity_pct.toFixed(0)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--ink-2)' }}>WIND</div>
                        <div style={{ fontSize: '18px', fontWeight: 600 }}>
                          {currentData.weather.wind_speed_kmh.toFixed(1)}{' '}
                          <span style={{ fontSize: '11px', fontWeight: 400 }}>km/h {getWindCompass(currentData.weather.wind_direction_deg)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Measured Pollutant Table */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '8px' }}>
                    <span style={{ textTransform: 'uppercase' }}>SPECIATED POLLUTANT DENSITY</span> (µg/m³)
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ink)', textAlign: 'left', color: 'var(--ink-2)', fontSize: '11px' }}>
                        <th style={{ padding: '6px 0' }}>POLLUTANT</th>
                        <th style={{ padding: '6px 0', textAlign: 'right' }}>VALUE</th>
                        <th style={{ padding: '6px 0', textAlign: 'right' }}>PROVENANCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                        <td style={{ padding: '8px 0', fontWeight: 500 }}>PM2.5 (Fine)</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                          {currentData?.primary_pm25.value?.toFixed(1) ?? '—'}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '11px', color: 'var(--ink-2)' }}>
                          {isSnapshot ? 'Archived Station Sensor' : isSample ? 'Synthetic Baseline' : 'Sensor Observed'}
                        </td>
                      </tr>
                      {currentData?.other_pollutants.map((p) => (
                        <tr key={p.parameter} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <td style={{ padding: '8px 0' }}>{p.display_name.split(' (')[0]}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{p.value?.toFixed(1) ?? '—'}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '11px', color: 'var(--ink-2)' }}>
                            {p.provenance === 'provider_forecast' ? 'CAMS Grid' : isSnapshot ? 'Archived Station Sensor' : isSample ? 'Synthetic Baseline' : 'Sensor Observed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 48-Hour Forecast Horizon */}
        <section style={{ padding: '32px 0 40px', borderTop: '1px solid var(--rule)' }}>
          <div className="container">
            <FadeContent>
              <ForecastChart
                observations={forecastData?.observations || []}
                providerForecast={forecastData?.provider_forecast || []}
                atlasModelForecast={forecastData?.atlas_model_forecast}
                atlasModelLower={forecastData?.atlas_model_lower}
                atlasModelUpper={forecastData?.atlas_model_upper}
                textSummary={
                  forecastData?.text_summary ||
                  'Awaiting time-series forecast telemetry...'
                }
                isStationMode={Boolean(selectedStationId)}
                stationReading={currentData?.primary_pm25.value}
                stationName={selectedStation?.name}
              />
            </FadeContent>
          </div>
        </section>

        {/* 3.5 Chronological Topography (60-Day Calendar Heatmap) */}
        <section style={{ padding: '32px 0 40px', borderTop: '1px solid var(--rule)' }}>
          <div className="container">
            <FadeContent>
              <CalendarHeatmap
                stationId={selectedStationId}
                stationName={selectedStation?.name || 'Monitoring Station'}
                apiBase={API_BASE}
              />
            </FadeContent>
          </div>
        </section>

        {/* 4. What Changed (Anomaly / Diurnal Analysis) */}
        <section className="container">
          <WhatChanged data={currentData} anomalies={anomalies} />
        </section>

        {/* 5. Model Honesty Box */}
        <section className="container">
          <FadeContent>
            <ModelHonestyBox metrics={modelMetrics} />
          </FadeContent>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default App;
