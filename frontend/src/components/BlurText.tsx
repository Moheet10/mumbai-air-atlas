import React, { useEffect, useState } from 'react';

interface BlurTextProps {
  text: string;
  delay?: number; // base delay in ms between words, default 45ms
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Editorial BlurText Component (ReactBits specification)
 * 
 * Delivers clean, ease-out typography entrance with progressive unblurring.
 * Zero-dependency implementation avoiding heavy animation runtimes (gsap / framer-motion).
 * Strictly honors `prefers-reduced-motion` by immediately rendering the target text statically.
 */
export const BlurText: React.FC<BlurTextProps> = ({
  text,
  delay = 45,
  className = '',
  style = {},
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (prefersReducedMotion) {
    return (
      <span className={className} style={style}>
        {text}
      </span>
    );
  }

  // Split into words, preserving spacing
  const words = text.split(' ');

  return (
    <span className={className} style={{ display: 'inline', ...style }}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            filter: 'blur(8px)',
            opacity: 0,
            transform: 'translateY(6px)',
            animation: 'editorialBlurIn 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            animationDelay: `${index * delay}ms`,
            willChange: 'filter, opacity, transform',
          }}
        >
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
      <style>{`
        @keyframes editorialBlurIn {
          0% {
            filter: blur(8px);
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            filter: blur(0px);
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </span>
  );
};

export default BlurText;
