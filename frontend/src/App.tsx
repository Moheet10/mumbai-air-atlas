import React, { useState, useEffect } from 'react';
import { Masthead } from './components/Masthead';
import { HeroAQI } from './components/HeroAQI';
import { StationMap } from './components/StationMap';
import { ForecastChart } from './components/ForecastChart';
import { WhatChanged } from './components/WhatChanged';
import { ModelHonestyBox } from './components/ModelHonestyBox';
import { Footer } from './components/Footer';
import type { CurrentConditionsResponse, ForecastResponse, Station } from './types';
import { getWindCompass } from './lib/aqi';
import './styles/design-tokens.css';

const API_BASE = 'http://localhost:8000';

export const App: React.FC = () => {
  const [currentData, setCurrentData] = useState<CurrentConditionsResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [modelMetrics, setModelMetrics] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('mpcb-bkc');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial stations and current conditions
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        // 1. Fetch stations
        const stRes = await fetch(`${API_BASE}/api/stations`);
        if (!stRes.ok) throw new Error(`HTTP ${stRes.status}`);
        const stData = await stRes.json();
        setStations(stData.stations || []);

        // 2. Fetch current conditions for default station
        const curRes = await fetch(`${API_BASE}/api/current?station_id=${selectedStationId}`);
        if (!curRes.ok) throw new Error(`HTTP ${curRes.status}`);
        const curData = await curRes.json();
        setCurrentData(curData);

        // 3. Fetch forecast
        const fcRes = await fetch(`${API_BASE}/api/forecast?station_id=${selectedStationId}`);
        if (!fcRes.ok) throw new Error(`HTTP ${fcRes.status}`);
        const fcData = await fcRes.json();
        setForecastData(fcData);

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Masthead
        lastUpdated={currentData?.generated_at}
        openaqStatus={currentData?.openaq_status}
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
              {/* Left Column: Map */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-editorial)', fontWeight: 500 }}>
                    Monitoring Topography
                  </h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>
                    CLICK TO FOCUS SENSOR
                  </span>
                </div>

                <div style={{ border: '1px solid var(--rule)', height: '420px', width: '100%' }}>
                  <StationMap
                    stations={stations}
                    selectedStationId={selectedStationId}
                    onSelectStation={handleSelectStation}
                  />
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
                    SELECTED FIELD INSTRUMENT
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    SPECIATED POLLUTANT DENSITY (µg/m³)
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
                          {currentData?.primary_pm25.provenance === 'observed_sample' ? 'Sensor Baseline' : 'Sensor Observed'}
                        </td>
                      </tr>
                      {currentData?.other_pollutants.map((p) => (
                        <tr key={p.parameter} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <td style={{ padding: '8px 0' }}>{p.display_name.split(' (')[0]}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{p.value?.toFixed(1) ?? '—'}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '11px', color: 'var(--ink-2)' }}>
                            {p.provenance === 'provider_forecast' ? 'CAMS Grid' : 'Sensor Observed'}
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
            <ForecastChart
              observations={forecastData?.observations || []}
              providerForecast={forecastData?.provider_forecast || []}
              atlasModelForecast={forecastData?.atlas_model_forecast}
              textSummary={
                forecastData?.text_summary ||
                'Diurnal inversion models suggest steady nocturnal accumulation followed by marine dispersion.'
              }
            />
          </div>
        </section>

        {/* 4. What Changed (Anomaly / Diurnal Analysis) */}
        <section className="container">
          <WhatChanged data={currentData} anomalies={anomalies} />
        </section>

        {/* 5. Model Honesty Box */}
        <section className="container">
          <ModelHonestyBox metrics={modelMetrics} />
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default App;
