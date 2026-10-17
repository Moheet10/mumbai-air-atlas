import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Wind } from 'lucide-react';

interface SplashScreenProps {
  isReady: boolean;
  onFinish?: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isReady,
  onFinish,
  minDurationMs = 850,
}) => {
  const [mounted, setMounted] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(15);
  const [stepIndex, setStepIndex] = useState(0);

  const mountTime = useRef<number>(Date.now());
  const hasExited = useRef<boolean>(false);

  const steps = [
    'CONNECTING TO CAAQMS GROUND TELEMETRY...',
    'ASSIMILATING OPEN-METEO NWP GRID...',
    'COMPUTING DISCRETE 80% ENSEMBLE HORIZONS...',
    'MUMBAI AIR ATLAS READY',
  ];

  const triggerExit = useCallback(() => {
    if (hasExited.current) return;
    hasExited.current = true;
    setProgress(100);
    setStepIndex(3);
    setIsExiting(true);
    setTimeout(() => {
      setMounted(false);
      if (onFinish) onFinish();
    }, 480);
  }, [onFinish]);

  // Telemetry step sequence & progress bar ticks
  useEffect(() => {
    const startTime = mountTime.current;
    const interval = setInterval(() => {
      if (hasExited.current) return;
      const elapsed = Date.now() - startTime;
      const pct = Math.min(95, Math.floor((elapsed / minDurationMs) * 100));
      setProgress((prev) => Math.max(prev, pct));

      if (elapsed > minDurationMs * 0.72) {
        setStepIndex(3);
      } else if (elapsed > minDurationMs * 0.45) {
        setStepIndex(2);
      } else if (elapsed > minDurationMs * 0.2) {
        setStepIndex(1);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [minDurationMs]);

  // Handle clean dismissal once data is ready without resetting the mount clock
  useEffect(() => {
    if (!isReady || hasExited.current) return;

    const elapsed = Date.now() - mountTime.current;
    const waitTime = Math.max(0, minDurationMs - elapsed);

    const timer = setTimeout(() => {
      triggerExit();
    }, waitTime);

    return () => clearTimeout(timer);
  }, [isReady, minDurationMs, triggerExit]);

  // Hard safety timeout: unconditionally dismiss after 2.2s so it never traps the user
  useEffect(() => {
    const maxTimer = setTimeout(() => {
      triggerExit();
    }, 2200);
    return () => clearTimeout(maxTimer);
  }, [triggerExit]);

  // Allow manual skip on click or Esc / Space / Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        triggerExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerExit]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mumbai Air Atlas loading sequence"
      onClick={triggerExit}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
        /* Solid curtain shutter wipe: lifts cleanly upward with zero double-exposure or text ghosting */
        transform: isExiting ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.46s cubic-bezier(0.77, 0, 0.175, 1)',
        pointerEvents: isExiting ? 'none' : 'auto',
      }}
    >
      {/* Background ambient radial aura */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--band-fill) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />

      {/* Inner Content Wrapper: fades out swiftly before curtain lifts */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'translateY(-20px)' : 'translateY(0)',
          transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
        }}
      >
        {/* Decorative Cartographic Compass Rose */}
        <div
          style={{
            position: 'relative',
            width: '130px',
            height: '130px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Outer Rotating Astrolabe Ring */}
          <svg
            viewBox="0 0 130 130"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              animation: 'atlas-spin 24s linear infinite',
            }}
          >
            <circle
              cx="65"
              cy="65"
              r="60"
              fill="none"
              stroke="var(--rule)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <circle
              cx="65"
              cy="65"
              r="52"
              fill="none"
              stroke="var(--rule)"
              strokeWidth="0.75"
            />
            {/* 4 Cardinal Tick Marks */}
            <line x1="65" y1="3" x2="65" y2="10" stroke="var(--ink)" strokeWidth="1.5" />
            <line x1="65" y1="120" x2="65" y2="127" stroke="var(--ink)" strokeWidth="1.5" />
            <line x1="3" y1="65" x2="10" y2="65" stroke="var(--ink)" strokeWidth="1.5" />
            <line x1="120" y1="65" x2="127" y2="65" stroke="var(--ink)" strokeWidth="1.5" />
          </svg>

          {/* Counter-rotating inner ring */}
          <svg
            viewBox="0 0 130 130"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              animation: 'atlas-spin-reverse 16s linear infinite',
            }}
          >
            <circle
              cx="65"
              cy="65"
              r="44"
              fill="none"
              stroke="var(--rule)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          </svg>

          {/* Center Emblem */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--ink)',
              color: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-md)',
              zIndex: 2,
            }}
          >
            <Wind size={22} strokeWidth={2.4} />
          </div>
        </div>

        {/* Main Brand Title & Coordinates */}
        <div style={{ textAlign: 'center', zIndex: 2, padding: '0 20px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              color: 'var(--ink-2)',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            ISSUE № 01 &middot; CAAQMS MONITORING NETWORK
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-editorial)',
              fontSize: 'clamp(32px, 5vw, 44px)',
              fontWeight: 500,
              letterSpacing: '0.08em',
              color: 'var(--ink)',
              margin: '0 0 6px 0',
              lineHeight: 1.1,
            }}
          >
            AIR ATLAS
          </h1>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--ink-2)',
              letterSpacing: '0.12em',
              marginBottom: '32px',
            }}
          >
            MUMBAI / INDIA &middot; 19.0760° N, 72.8777° E
          </div>

          {/* Hairline Progress Bar */}
          <div
            style={{
              width: '240px',
              height: '2px',
              backgroundColor: 'var(--rule)',
              margin: '0 auto 16px',
              borderRadius: '1px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: 'var(--ink)',
                transition: 'width 0.15s ease-out',
              }}
            />
          </div>

          {/* Sequenced Telemetry Step */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: 'var(--ink-2)',
              minHeight: '18px',
              transition: 'color 0.2s ease',
            }}
          >
            {steps[stepIndex]}
          </div>

          {/* Subtle Skip Hint */}
          <div
            style={{
              marginTop: '28px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--ink-2)',
              opacity: 0.75,
              letterSpacing: '0.04em',
            }}
          >
            [ CLICK ANYWHERE OR PRESS ESC TO ENTER ]
          </div>
        </div>
      </div>

      {/* Embedded Spin Animations */}
      <style>{`
        @keyframes atlas-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes atlas-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
