import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer style={{ borderTop: '1px solid var(--rule)', padding: '36px 0 56px' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginBottom: '28px' }}>
          <div>
            <h4 style={{ fontSize: '16px', fontFamily: 'var(--font-editorial)', fontWeight: 500, marginBottom: '8px' }}>
              Mumbai Air Atlas
            </h4>
            <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '15px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              An editorial field instrument tracking diurnal particulate dynamics, coastal meteorological convergence, and air quality across Greater Mumbai.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '16px', fontFamily: 'var(--font-editorial)', fontWeight: 500, marginBottom: '8px' }}>
              Data Provenance &amp; Attribution
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.8 }}>
              <li>&bull; Ground stations: CPCB / MPCB CAAQMS via OpenAQ v3 API</li>
              <li>&bull; Grid forecast: Copernicus CAMS Atmospheric Ensemble (Open-Meteo)</li>
              <li>&bull; Surface meteorology: ECMWF IFS / GFS Diagnostics (Open-Meteo)</li>
              <li>&bull; Cartography: &copy; OpenStreetMap contributors, &copy; CARTO</li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '16px', fontFamily: 'var(--font-editorial)', fontWeight: 500, marginBottom: '8px' }}>
              Known Constraints
            </h4>
            <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Open-Meteo air quality forecasts represent ~40 km grid model estimates rather than micro-local physical sensors. Physical stations are subject to telemetry downtime and periodic sensor recalibration by municipal bodies.
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>
          <span>PORTFOLIO DEMONSTRATION &middot; FOUR-WEEK BUILD MILESTONE 1</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="editorial-link">
              GitHub Repository
            </a>
            <a href="https://docs.openaq.org" target="_blank" rel="noreferrer" className="editorial-link">
              OpenAQ Docs
            </a>
            <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="editorial-link">
              Open-Meteo API
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
