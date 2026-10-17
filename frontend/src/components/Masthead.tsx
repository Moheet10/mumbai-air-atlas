import React from 'react';

interface MastheadProps {
  lastUpdated?: string;
  openaqStatus?: string;
  onOpenFreshness?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Masthead: React.FC<MastheadProps> = ({
  lastUpdated,
  openaqStatus,
  onOpenFreshness,
  theme,
  onToggleTheme,
}) => {
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
          {/* Day / Night Edition Text Toggle */}
          <button
            onClick={onToggleTheme}
            className="editorial-btn"
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              borderBottom: '1px solid var(--rule)',
              letterSpacing: '0.04em',
              padding: '2px 0',
            }}
            title="Toggle Day / Night edition"
            aria-label="Toggle Day / Night edition"
          >
            <span style={{ fontWeight: theme === 'light' ? 600 : 400, color: theme === 'light' ? 'var(--ink)' : 'var(--ink-2)' }}>Day</span>
            <span style={{ color: 'var(--rule)', margin: '0 2px' }}>/</span>
            <span style={{ fontWeight: theme === 'dark' ? 600 : 400, color: theme === 'dark' ? 'var(--ink)' : 'var(--ink-2)' }}>Night</span>
          </button>

          {openaqStatus === 'snapshot' && (
            <button
              onClick={onOpenFreshness}
              className="editorial-btn"
              style={{ fontSize: '12px', color: 'var(--ink-2)', borderBottom: '1px dotted var(--ink-2)' }}
              title="Click to inspect telemetry provenance and API status"
            >
              MODE: SNAPSHOT (14 OCT 2026)
            </button>
          )}
          {openaqStatus === 'missing_key' && (
            <button
              onClick={onOpenFreshness}
              className="editorial-btn"
              style={{ fontSize: '12px', color: 'var(--ink-2)', borderBottom: '1px dotted var(--ink-2)' }}
              title="Click to inspect telemetry provenance and API status"
            >
              MODE: SAMPLE DIRECTORY (DEMO)
            </button>
          )}
          {openaqStatus === 'connected' && (
            <button
              onClick={onOpenFreshness}
              className="editorial-btn"
              style={{ fontSize: '12px', color: 'var(--aqi-good)', fontWeight: 500, borderBottom: '1px dotted var(--aqi-good)' }}
            >
              &bull; OPENAQ V3 CONNECTED
            </button>
          )}
          {lastUpdated && <span>UPDATED: {lastUpdated}</span>}
        </div>
      </div>
    </header>
  );
};
