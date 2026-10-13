import React from 'react';

interface MastheadProps {
  lastUpdated?: string;
  openaqStatus?: string;
}

export const Masthead: React.FC<MastheadProps> = ({ lastUpdated, openaqStatus }) => {
  return (
    <header className="masthead" style={{ borderBottom: '1px solid var(--rule)', padding: '16px 0' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '15px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AIR ATLAS
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink-2)' }}>
            MUMBAI / INDIA &middot; 19.0760° N, 72.8777° E
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>
          {openaqStatus === 'missing_key' && (
            <span style={{ borderBottom: '1px dotted var(--ink-2)' }} title="OpenAQ API key not supplied; showing calibrated baseline station network">
              MODE: BASELINE FIELD STATIONS
            </span>
          )}
          {openaqStatus === 'connected' && (
            <span style={{ color: 'var(--aqi-good)', fontWeight: 500 }}>
              &bull; OPENAQ V3 CONNECTED
            </span>
          )}
          {lastUpdated && <span>UPDATED: {lastUpdated}</span>}
        </div>
      </div>
    </header>
  );
};
