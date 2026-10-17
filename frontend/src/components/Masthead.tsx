import { Wind, Sun, Moon, Clock } from 'lucide-react';

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
    <header
      className="masthead"
      style={{
        borderBottom: '1px solid var(--rule)',
        padding: '14px 0',
        backgroundColor: 'var(--paper)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Brand identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--ink)',
              color: 'var(--paper)',
            }}
          >
            <Wind size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  fontSize: '15px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink)',
                }}
              >
                AIR ATLAS
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--ink-2)',
                  letterSpacing: '0.04em',
                }}
              >
                MUMBAI / INDIA
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--ink-2)',
                letterSpacing: '0.04em',
              }}
            >
              19.0760° N, 72.8777° E &middot; CAAQMS NETWORK
            </div>
          </div>
        </div>

        {/* Right controls: Status pill, Theme Switch, Timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            flexWrap: 'wrap',
          }}
        >
          {/* Mode Badge */}
          {openaqStatus === 'snapshot' && (
            <button
              onClick={onOpenFreshness}
              className="atlas-pill"
              title="Click to inspect telemetry provenance and API status"
              style={{ cursor: 'pointer' }}
            >
              <span
                className="pulse-beacon"
                style={{ backgroundColor: 'var(--aqi-moderate)' }}
              />
              <span>SNAPSHOT ARCHIVE</span>
            </button>
          )}
          {openaqStatus === 'missing_key' && (
            <button
              onClick={onOpenFreshness}
              className="atlas-pill"
              title="Click to inspect telemetry provenance and API status"
              style={{ cursor: 'pointer' }}
            >
              <span
                className="pulse-beacon"
                style={{ backgroundColor: 'var(--ink-2)' }}
              />
              <span>DEMO MODE</span>
            </button>
          )}
          {openaqStatus === 'connected' && (
            <button
              onClick={onOpenFreshness}
              className="atlas-pill"
              title="Click to inspect telemetry provenance and API status"
              style={{ cursor: 'pointer', borderColor: 'var(--aqi-good)' }}
            >
              <span
                className="pulse-beacon"
                style={{ backgroundColor: 'var(--aqi-good)' }}
              />
              <span style={{ color: 'var(--aqi-good)', fontWeight: 600 }}>OPENAQ LIVE</span>
            </button>
          )}

          {/* Theme segmented toggle */}
          <div className="segmented-group" role="radiogroup" aria-label="Theme selector">
            <button
              onClick={onToggleTheme}
              className={`segmented-btn ${theme === 'light' ? 'active' : ''}`}
              title="Switch to Day Edition"
              aria-label="Toggle Day / Night edition"
              type="button"
            >
              <Sun size={12} strokeWidth={2.2} />
              <span>Day</span>
            </button>
            <button
              onClick={onToggleTheme}
              className={`segmented-btn ${theme === 'dark' ? 'active' : ''}`}
              title="Switch to Night Edition"
              aria-label="Toggle Day / Night edition"
              type="button"
            >
              <Moon size={12} strokeWidth={2.2} />
              <span>Night</span>
            </button>
          </div>

          {lastUpdated && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--ink-2)',
                fontSize: '11px',
              }}
            >
              <Clock size={12} />
              <span>{lastUpdated}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

