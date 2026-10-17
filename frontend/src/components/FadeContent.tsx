import React, { useEffect, useRef, useState } from 'react';

interface FadeContentProps {
  children: React.ReactNode;
  blur?: boolean;
  duration?: number; // duration in ms, default 600
  delay?: number; // delay in ms, default 0
  threshold?: number; // intersection observer threshold, default 0.1
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Editorial FadeContent Component (ReactBits specification)
 * 
 * Smooth, lightweight entrance trigger for data-dense journalistic sections.
 * Zero-dependency implementation using native browser IntersectionObserver.
 * Strictly honors `prefers-reduced-motion` by immediately rendering children without transition.
 */
export const FadeContent: React.FC<FadeContentProps> = ({
  children,
  blur = false,
  duration = 600,
  delay = 0,
  threshold = 0.1,
  className = '',
  style = {},
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
    }
    return false;
  });

  const domRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If user prefers reduced motion, show immediately
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const currentElem = domRef.current;
    if (!currentElem) return;

    // Native IntersectionObserver with single-trigger unobserve
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(currentElem);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animationStyle: React.CSSProperties = prefersReducedMotion
    ? { opacity: 1, transform: 'none', filter: 'none' }
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
        filter: blur ? (isVisible ? 'blur(0px)' : 'blur(6px)') : 'none',
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms${
          blur ? `, filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms` : ''
        }`,
        willChange: 'opacity, transform',
      };

  return (
    <div
      ref={domRef}
      className={className}
      style={{
        ...style,
        ...animationStyle,
      }}
    >
      {children}
    </div>
  );
};

export default FadeContent;
