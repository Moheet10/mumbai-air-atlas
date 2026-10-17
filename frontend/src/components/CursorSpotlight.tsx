import React, { useEffect, useRef, useState } from 'react';

interface CursorSpotlightProps {
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * Editorial Cursor Spotlight Mover
 * 
 * Dynamic cursor follower layer that:
 * - In Night mode: Lightens & highlights the atmosphere near the cursor like a navigator's lantern.
 * - In Day mode: Darkens & shades the paper near the cursor like a focusing optic/lens.
 * 
 * Implemented with zero-dependency lerped requestAnimationFrame loop and pointer-events: none.
 */
export const CursorSpotlight: React.FC<CursorSpotlightProps> = ({
  theme = 'light',
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
          // Night mode: Lightens and highlights near the cursor with a warm luminous halo
          spotlightRef.current.style.background = `
            radial-gradient(520px circle at ${currentX}px ${currentY}px, rgba(255, 245, 215, 0.13) 0%, rgba(255, 240, 200, 0.04) 45%, transparent 75%),
            radial-gradient(220px circle at ${currentX}px ${currentY}px, rgba(255, 250, 235, 0.08) 0%, transparent 80%)
          `;
        } else {
          // Day mode: Darkens and shades near the cursor with a rich tactile parchment burnish
          spotlightRef.current.style.background = `
            radial-gradient(460px circle at ${currentX}px ${currentY}px, rgba(27, 26, 23, 0.08) 0%, rgba(27, 26, 23, 0.025) 45%, transparent 75%)
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
  }, [isDark]);

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
