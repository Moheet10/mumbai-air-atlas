import React, { useEffect, useRef } from 'react';

interface AtmosphericParticlesProps {
  particleCount?: number;
  color?: string;
  theme?: 'light' | 'dark';
  windSpeedKmh?: number;
  windDirectionDeg?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

export const AtmosphericParticles: React.FC<AtmosphericParticlesProps> = ({
  particleCount = 26,
  color,
  theme = 'light',
  windSpeedKmh = 10,
  windDirectionDeg = 340,
  className = '',
  style = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // Physical wind drift vector (wind blows FROM windDirectionDeg, particles drift TOWARDS opposite)
    const windRad = (((windDirectionDeg + 180) % 360) * Math.PI) / 180;
    const windSpeedFactor = 0.08 + Math.min(0.55, (windSpeedKmh / 30.0) * 0.45);
    const baseVx = Math.sin(windRad) * windSpeedFactor;
    const baseVy = -Math.cos(windRad) * windSpeedFactor;

    // Particulate color: 50% reverted subtle balance
    const isDark = theme === 'dark';
    const defaultParticleColor =
      color || (isDark ? 'rgba(255, 248, 230, 0.65)' : 'rgba(27, 26, 23, 0.50)');

    // Generate particulate array (delicate 1.0-2.4px PM2.5 specks, reduced count & density)
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: baseVx + (Math.random() - 0.5) * 0.22,
      vy: baseVy + (Math.random() - 0.5) * 0.22,
      size: 0.9 + Math.random() * 1.5,
      baseAlpha: isDark ? (0.22 + Math.random() * 0.24) : (0.18 + Math.random() * 0.22),
      alpha: 0.25,
      pulseSpeed: 0.01 + Math.random() * 0.018,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx;
          p.y += p.vy;
          p.pulsePhase += p.pulseSpeed;
          p.alpha = p.baseAlpha + Math.sin(p.pulsePhase) * 0.08;

          // Mouse gentle repel
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist < 90 && dist > 0) {
            const force = (90 - dist) / 90;
            p.x += (dx / dist) * force * 1.0;
            p.y += (dy / dist) * force * 1.0;
          }

          // Wrap edges
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
        }

        ctx.fillStyle = defaultParticleColor;
        ctx.globalAlpha = Math.max(0.08, Math.min(0.55, p.alpha));
        if (isDark) {
          ctx.shadowColor = 'rgba(255, 235, 175, 0.25)';
          ctx.shadowBlur = 1.5;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      if (!reduceMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, [particleCount, color, theme, windSpeedKmh, windDirectionDeg]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
};

export default AtmosphericParticles;
