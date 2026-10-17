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
import { AtmosphericParticles } from './components/AtmosphericParticles';
import { SpotlightCard } from './components/SpotlightCard';
import { SplashScreen } from './components/SplashScreen';
import { ClickSpark } from './components/ClickSpark';
import { WindRoseWidget } from './components/WindRoseWidget';
import { CursorSpotlight } from './components/CursorSpotlight';
import { calculatePM25AQI } from './lib/aqi';
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

  // Compute atmospheric glow color matching hero AQI category (e.g. golden amber for Moderate)
  const pm25Value = currentData?.primary_pm25?.value ?? 62.1;
  const { category: currentCategory } = calculatePM25AQI(pm25Value);
  const aqiGlowColor = theme === 'dark' && currentCategory.label === 'Moderate'
    ? '#ECC254'
    : currentCategory.colorHex;

  return (
    <ClickSpark
      sparkColor={
        theme === 'dark'
          ? ['#FFF9C4', '#FFE082', '#FFD54F', '#FFFFFF']
          : ['#8C2D04', '#B45309', '#1E1B18', '#78350F']
      }
      sparkCount={8}
      sparkSize={theme === 'dark' ? 13 : 11}
      sparkRadius={28}
      sparkWidth={theme === 'dark' ? 2.2 : 2.0}
      glow={theme === 'dark' ? 0.75 : 0.15}
      ring={true}
    >
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Dynamic Interactive Cursor Mover: Matches the exact atmospheric golden/AQI glow */}
        <CursorSpotlight theme={theme} glowColor={aqiGlowColor} />

        {/* Editorial Air Atlas Splash Screen */}
        <SplashScreen isReady={!loading && currentData !== null} />

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

        {/* 1. Hero AQI Section with subtle atmospheric particulate layer */}
        <div style={{ position: 'relative' }}>
          <AtmosphericParticles
            theme={theme}
            windSpeedKmh={currentData?.weather.wind_speed_kmh}
            windDirectionDeg={currentData?.weather.wind_direction_deg}
          />
          <HeroAQI data={currentData} loading={loading} theme={theme} />
        </div>

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
                    Monitoring Topography
                  </h3>

                  {/* View Mode Segmented Control */}
                  <div className="segmented-group">
                    <button
                      onClick={() => setViewMode('map')}
                      className={`segmented-btn ${viewMode === 'map' ? 'active' : ''}`}
                    >
                      MAP VIEW
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`segmented-btn ${viewMode === 'list' ? 'active' : ''}`}
                    >
                      DIRECTORY ({stations.length})
                    </button>
                  </div>
                </div>

                <div
                  className="atlas-card"
                  style={{
                    height: '420px',
                    width: '100%',
                    overflow: 'hidden',
                  }}
                >
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

                {/* Station Quick Selector Bar as interactive pills */}
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {stations.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStation(s.id)}
                      className={`atlas-pill ${s.id === selectedStationId ? 'active' : ''}`}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {s.id === selectedStationId && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: theme === 'dark' ? '#6EE7B7' : '#265C3E',
                            boxShadow: theme === 'dark'
                              ? '0 0 8px rgba(110, 231, 183, 0.9), 0 0 16px rgba(110, 231, 183, 0.4)'
                              : '0 0 6px rgba(38, 92, 62, 0.7), 0 1px 2px rgba(0, 0, 0, 0.25)',
                            display: 'inline-block',
                          }}
                        />
                      )}
                      <span>{s.area}</span>
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>
                    {selectedStation?.agency} &middot; {selectedStation?.coordinates.latitude.toFixed(4)}°N,{' '}
                    {selectedStation?.coordinates.longitude.toFixed(4)}°E
                  </div>
                </div>

                {/* Surface Meteorology Summary using SpotlightCard */}
                {currentData && (
                  <SpotlightCard
                    theme={theme}
                    style={{
                      marginBottom: '20px',
                      padding: '16px 20px',
                      backgroundColor: 'var(--paper-2)',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      SURFACE METEOROLOGY (OPEN-METEO)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--ink-2)' }}>AIR TEMPERATURE</div>
                        <div style={{ fontSize: '22px', fontWeight: 600 }}>{currentData.weather.temperature_c.toFixed(1)}°C</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--ink-2)' }}>RELATIVE HUMIDITY</div>
                        <div style={{ fontSize: '22px', fontWeight: 600 }}>{currentData.weather.relative_humidity_pct.toFixed(0)}%</div>
                      </div>
                    </div>
                    {/* Live Navigational Wind Rose Compass Widget */}
                    <WindRoseWidget
                      speedKmh={currentData.weather.wind_speed_kmh}
                      directionDeg={currentData.weather.wind_direction_deg}
                    />
                  </SpotlightCard>
                )}

                {/* Measured Pollutant Table inside SpotlightCard */}
                <SpotlightCard theme={theme} style={{ padding: '16px 20px', backgroundColor: 'var(--paper-2)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '10px', letterSpacing: '0.04em' }}>
                    <span style={{ textTransform: 'uppercase' }}>SPECIATED POLLUTANT DENSITY</span> (µg/m³)
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ink)', textAlign: 'left', color: 'var(--ink-2)', fontSize: '10px' }}>
                        <th style={{ padding: '6px 0' }}>POLLUTANT</th>
                        <th style={{ padding: '6px 0', textAlign: 'right' }}>VALUE</th>
                        <th style={{ padding: '6px 0', textAlign: 'right' }}>PROVENANCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>PM2.5 (Fine)</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                          {currentData?.primary_pm25.value?.toFixed(1) ?? '—'}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '10px', color: 'var(--ink-2)' }}>
                          {isSnapshot ? 'Archived Sensor' : isSample ? 'Synthetic Baseline' : 'Sensor Observed'}
                        </td>
                      </tr>
                      {currentData?.other_pollutants.map((p) => (
                        <tr key={p.parameter} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <td style={{ padding: '8px 0' }}>{p.display_name.split(' (')[0]}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>{p.value?.toFixed(1) ?? '—'}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '10px', color: 'var(--ink-2)' }}>
                            {p.provenance === 'provider_forecast' ? 'CAMS Grid' : isSnapshot ? 'Archived Sensor' : isSample ? 'Synthetic Baseline' : 'Sensor Observed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SpotlightCard>
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
    </ClickSpark>
  );
};

export default App;
