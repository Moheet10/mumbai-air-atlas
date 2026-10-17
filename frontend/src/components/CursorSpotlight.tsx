import React, { useEffect, useRef, useState } from 'react';

interface CursorSpotlightProps {
  theme?: 'light' | 'dark';
  glowColor?: string;
  className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return [r, g, b];
    }
  }
  return [236, 194, 84]; // default golden amber (#ECC254)
};

/**
 * Editorial Atmospheric Cursor Spotlight Mover
 * 
 * Dynamically casts an interactive halo that matches the exact golden/ambient
 * atmospheric gradient from the AQI hero aura:
 * - In Night mode: Lightens & highlights near the cursor with a warm luminous golden glow.
 * - In Day mode: Shimmers near the cursor with a warm amber atmospheric tone.
 * 
 * Zero-drag requestAnimationFrame lerp loop with pointer-events: none.
 */
export const CursorSpotlight: React.FC<CursorSpotlightProps> = ({
  theme = 'light',
  glowColor = '#ECC254',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const [isVisible, setIsVisible] = useState(false);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only enable for pointer devices (mouse/trackpad), not touch screens
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = -1000;
    let targetY = -1000;
    let currentX = -1000;
    let currentY = -1000;
    let animId: number;
    let isMoving = false;

    const [r, g, b] = hexToRgb(glowColor);

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!isMoving) {
        setIsVisible(true);
        isMoving = true;
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    const updateLoop = () => {
      if (spotlightRef.current) {
        // Smooth lerp interpolation
        currentX += (targetX - currentX) * 0.14;
        currentY += (targetY - currentY) * 0.14;

        if (isDark) {
          // Night mode: Lightens & highlights with the exact warm golden atmospheric color
          spotlightRef.current.style.background = `
            radial-gradient(540px circle at ${currentX}px ${currentY}px, rgba(${r}, ${g}, ${b}, 0.22) 0%, rgba(${r}, ${g}, ${b}, 0.07) 45%, transparent 75%),
            radial-gradient(220px circle at ${currentX}px ${currentY}px, rgba(${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(255, b + 40)}, 0.14) 0%, transparent 80%)
          `;
        } else {
          // Day mode: Shimmers with warm amber-terracotta atmospheric tone
          spotlightRef.current.style.background = `
            radial-gradient(460px circle at ${currentX}px ${currentY}px, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.05) 45%, transparent 75%)
          `;
        }
      }
      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(animId);
    };
  }, [isDark, glowColor]);

  return (
    <div
      ref={spotlightRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1, // Floats subtly above background elements, below interactive content
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        willChange: 'background',
      }}
    />
  );
};

export default CursorSpotlight;
