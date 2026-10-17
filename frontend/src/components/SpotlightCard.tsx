import React, { useRef, useState, useEffect } from 'react';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  theme?: 'light' | 'dark';
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return hex;
};

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  spotlightColor,
  theme = 'light',
  className = '',
  children,
  style = {},
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const isDark = theme === 'dark';
  // Calibrated spotlight glow matching golden atmospheric aura or custom color
  const activeSpotlight = spotlightColor
    ? (spotlightColor.startsWith('#') ? hexToRgba(spotlightColor, isDark ? 0.24 : 0.18) : spotlightColor)
    : (isDark
      ? 'rgba(236, 194, 84, 0.22)'
      : 'rgba(224, 179, 65, 0.18)');

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPosition({ x, y });
    };

    const handleMouseEnter = () => setOpacity(1);
    const handleMouseLeave = () => setOpacity(0);

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`atlas-card ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {/* Subtle cursor-following spotlight glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity,
          transition: 'opacity 0.25s ease',
          background: `radial-gradient(420px circle at ${position.x}px ${position.y}px, ${activeSpotlight}, transparent 70%)`,
          zIndex: 1,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  );
};

export default SpotlightCard;
