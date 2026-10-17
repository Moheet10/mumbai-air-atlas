import React from 'react';

export type AuraPosition =
  | 'top-right'
  | 'top-left'
  | 'center-right'
  | 'center-left'
  | 'bottom-right'
  | 'bottom-left';

interface AtmosphericAuraProps {
  color?: string;
  theme?: 'light' | 'dark';
  position?: AuraPosition;
  secondaryPosition?: AuraPosition;
  hasWash?: boolean;
  className?: string;
}

const getAuraStyles = (
  pos: AuraPosition,
  color: string,
  isDark: boolean,
  isSecondary: boolean = false
): React.CSSProperties => {
  const opacity = isSecondary
    ? isDark ? 0.20 : 0.15
    : isDark ? 0.38 : 0.28;
  const filter = isSecondary
    ? isDark ? 'blur(88px)' : 'blur(72px)'
    : isDark ? 'blur(80px)' : 'blur(65px)';

  const base: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 0,
    opacity,
    filter,
  };

  switch (pos) {
    case 'top-right':
      return {
        ...base,
        top: '-150px',
        right: '-80px',
        width: '880px',
        height: '640px',
        background: isDark
          ? `radial-gradient(ellipse at 65% 35%, ${color} 0%, ${color}99 38%, transparent 72%)`
          : `radial-gradient(ellipse at 65% 35%, ${color} 0%, ${color}88 35%, transparent 68%)`,
      };
    case 'top-left':
      return {
        ...base,
        top: '-130px',
        left: '-90px',
        width: '860px',
        height: '620px',
        background: isDark
          ? `radial-gradient(ellipse at 35% 35%, ${color} 0%, ${color}99 38%, transparent 72%)`
          : `radial-gradient(ellipse at 35% 35%, ${color} 0%, ${color}88 35%, transparent 68%)`,
      };
    case 'center-right':
      return {
        ...base,
        top: '15%',
        right: '-90px',
        width: '900px',
        height: '640px',
        background: isDark
          ? `radial-gradient(ellipse at 65% 50%, ${color} 0%, ${color}99 36%, transparent 72%)`
          : `radial-gradient(ellipse at 65% 50%, ${color} 0%, ${color}88 35%, transparent 68%)`,
      };
    case 'center-left':
      return {
        ...base,
        top: '15%',
        left: '-100px',
        width: '880px',
        height: '600px',
        background: isDark
          ? `radial-gradient(ellipse at 35% 50%, ${color} 0%, ${color}99 36%, transparent 72%)`
          : `radial-gradient(ellipse at 35% 50%, ${color} 0%, ${color}88 35%, transparent 68%)`,
      };
    case 'bottom-right':
      return {
        ...base,
        bottom: '-70px',
        right: '-70px',
        width: '740px',
        height: '520px',
        background: `radial-gradient(circle at 70% 70%, ${color} 0%, transparent 68%)`,
      };
    case 'bottom-left':
      return {
        ...base,
        bottom: '-70px',
        left: '-70px',
        width: '720px',
        height: '500px',
        background: `radial-gradient(circle at 30% 70%, ${color} 0%, transparent 68%)`,
      };
  }
};

/**
 * Editorial Atmospheric Gradient Aura
 * 
 * Recreates the rich warm golden atmospheric radial gradient from the Hero AQI section
 * and weaves it seamlessly across any section on the page.
 */
export const AtmosphericAura: React.FC<AtmosphericAuraProps> = ({
  color = '#ECC254',
  theme = 'light',
  position = 'top-right',
  secondaryPosition,
  hasWash = false,
  className = '',
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* 1. Primary Atmospheric Radial Bloom */}
      <div style={getAuraStyles(position, color, isDark, false)} />

      {/* 2. Secondary Ambient Volumetric Diffusion (if requested) */}
      {secondaryPosition && (
        <div style={getAuraStyles(secondaryPosition, color, isDark, true)} />
      )}

      {/* 3. Baseline Atmospheric Wash (if requested) */}
      {hasWash && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '140px',
            background: `linear-gradient(to top, ${color}18 0%, transparent 100%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default AtmosphericAura;
