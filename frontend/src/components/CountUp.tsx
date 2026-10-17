import React, { useEffect, useState, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number; // duration in seconds
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Editorial CountUp Component (ReactBits specification)
 * 
 * Delivers clean, ease-out counting animation for the Hero AQI integer.
 * Zero-dependency implementation avoiding heavy animation runtimes (gsap / framer-motion).
 * Strictly honors `prefers-reduced-motion` by immediately rendering the target value.
 */
export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1.2,
  className = '',
  style = {},
}) => {
  const [displayValue, setDisplayValue] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return to;
    }
    return from;
  });

  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Check user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(to);
      return;
    }

    const startVal = displayValue;
    const diff = to - startVal;
    const durationMs = duration * 1000;

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / durationMs, 1);

      // Smooth editorial cubic ease-out
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * easedProgress);

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [to, duration]);

  return (
    <span
      className={className}
      style={{
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {displayValue}
    </span>
  );
};
