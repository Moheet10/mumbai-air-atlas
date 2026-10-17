import React, { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type Easing = 'smooth' | 'linear' | 'snappy';
type Trigger = 'loop' | 'hover' | 'view';

export interface ShinyTextProps {
  text?: string;
  children?: ReactNode;
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  angle?: number;
  shineWidth?: number;
  softness?: number;
  bands?: number;
  glow?: number;
  direction?: 'left' | 'right';
  easing?: Easing;
  trigger?: Trigger;
  yoyo?: boolean;
  followPointer?: boolean;
  pauseOnHover?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Settings {
  color: string;
  shineColor: string;
  speed: number;
  delay: number;
  angle: number;
  shineWidth: number;
  softness: number;
  bands: number;
  glow: number;
  sign: number;
  ease: (t: number) => number;
  trigger: Trigger;
  yoyo: boolean;
  followPointer: boolean;
  pauseOnHover: boolean;
  disabled: boolean;
}

const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  smooth: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
  snappy: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
};
const TRIGGERS: Trigger[] = ['loop', 'hover', 'view'];
const FALLOFF = [0, 0.2, 0.4, 0.6, 0.8, 1];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

let paint: CanvasRenderingContext2D | null = null;

const parseColor = (value: string): number[] | null => {
  if (typeof document === 'undefined') return null;
  if (!paint) paint = document.createElement('canvas').getContext('2d');
  if (!paint) return null;
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  const resolved = String(paint.fillStyle);
  if (resolved.startsWith('#')) {
    return [1, 3, 5].map((i) => parseInt(resolved.slice(i, i + 2), 16)).concat(1);
  }
  const parts = resolved.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  return [Number(parts[0]), Number(parts[1]), Number(parts[2]), parts.length > 3 ? Number(parts[3]) : 1];
};

const blend = (from: number[], to: number[], amount: number) => {
  const channel = (a: number, b: number) =>
    Math.round(Math.pow(Math.pow(a / 255, 2.2) * (1 - amount) + Math.pow(b / 255, 2.2) * amount, 1 / 2.2) * 255);
  const alpha = from[3] * (1 - amount) + to[3] * amount;
  if (alpha <= 0) return 'rgba(0, 0, 0, 0)';
  const weigh = (a: number, b: number) => (a * from[3] * (1 - amount) + b * to[3] * amount) / alpha;
  const r = from[3] === to[3] ? channel(from[0], to[0]) : Math.round(weigh(from[0], to[0]));
  const g = from[3] === to[3] ? channel(from[1], to[1]) : Math.round(weigh(from[1], to[1]));
  const b = from[3] === to[3] ? channel(from[2], to[2]) : Math.round(weigh(from[2], to[2]));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
};

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  children,
  color = 'var(--ink)',
  shineColor = 'var(--paper)',
  speed = 2.4,
  delay = 0,
  angle = 120,
  shineWidth = 40,
  softness = 0.8,
  bands = 1,
  glow = 0,
  direction = 'left',
  easing = 'smooth',
  trigger = 'loop',
  yoyo = false,
  followPointer = false,
  pauseOnHover = false,
  disabled = false,
  className = '',
  style,
}) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const settingsRef = useRef<Settings | null>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const content = children ?? text;

  settingsRef.current = {
    color,
    shineColor,
    speed: Math.max(0.1, speed),
    delay: Math.max(0, delay),
    angle,
    shineWidth: clamp(shineWidth, 2, 200),
    softness: clamp(softness, 0, 1),
    bands: clamp(Math.round(bands), 1, 3),
    glow: clamp(glow, 0, 1),
    sign: direction === 'right' ? 1 : -1,
    ease: EASINGS[easing as Easing] ?? EASINGS.smooth,
    trigger: TRIGGERS.includes(trigger as Trigger) ? (trigger as Trigger) : 'loop',
    yoyo,
    followPointer,
    pauseOnHover,
    disabled,
  };

  useEffect(() => {
    syncRef.current?.();
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const state = {
      pos: null as number | null,
      vel: 0,
      phase: 'idle',
      from: 0,
      to: 0,
      start: 0,
      duration: 1,
      resume: 0,
      flip: false,
      inside: false,
      target: 0,
      visible: true,
      seen: false,
      colors: '',
    };
    let base: number[] | null = null;
    let shine: number[] | null = null;
    let clear: number[] | null = null;
    let raf = 0;
    let timer = 0;
    let alive = true;

    const extent = () => {
      const s = settingsRef.current!;
      return s.shineWidth / 2 + (s.bands - 1) * s.shineWidth * 1.3 + 2;
    };
    const entry = () => (settingsRef.current!.sign > 0 ? -extent() : 100 + extent());
    const exit = () => (settingsRef.current!.sign > 0 ? 100 + extent() : -extent());

    const gradient = (pos: number, fill: number[]) => {
      const s = settingsRef.current!;
      const half = s.shineWidth / 2;
      const core = half * (1 - s.softness);
      const fade = half - core;
      const stops: [number, number][] = [];
      for (let band = 0; band < s.bands; band++) {
        const center = pos - s.sign * band * s.shineWidth * 1.3;
        const strength = 1 - band * 0.28;
        for (const side of [-1, 1]) {
          for (const f of FALLOFF) {
            const at = center + side * (core + fade * (1 - f));
            const amount = f * f * (3 - 2 * f) * strength;
            stops.push([at, amount]);
          }
        }
      }
      stops.sort((a, b) => a[0] - b[0]);
      const list = stops.map(([at, amount]) => `${blend(fill, shine!, amount)} ${at.toFixed(2)}%`);
      return `linear-gradient(${s.angle}deg, ${blend(fill, shine!, 0)} 0%, ${list.join(', ')}, ${blend(fill, shine!, 0)} 100%)`;
    };

    const draw = () => {
      const s = settingsRef.current!;
      const key = `${s.color}|${s.shineColor}`;
      if (key !== state.colors) {
        state.colors = key;
        base = parseColor(s.color);
        shine = parseColor(s.shineColor);
        clear = shine ? [shine[0], shine[1], shine[2], 0] : null;
      }
      if (!base || !shine) {
        root.style.backgroundImage = `linear-gradient(${s.color}, ${s.color})`;
        return;
      }
      if (state.pos === null || s.disabled) {
        root.style.backgroundImage = `linear-gradient(${s.color}, ${s.color})`;
        if (glowRef.current) glowRef.current.style.backgroundImage = 'none';
        return;
      }
      root.style.backgroundImage = gradient(state.pos, base!);
      if (glowRef.current) {
        glowRef.current.style.backgroundImage = gradient(state.pos, clear!);
        glowRef.current.style.opacity = String(s.glow);
      }
    };

    const sweep = (from: number, to: number, now: number) => {
      const s = settingsRef.current!;
      const span = Math.abs(exit() - entry()) || 1;
      state.phase = 'sweep';
      state.from = from;
      state.to = to;
      state.start = now;
      state.duration = s.speed * 1000 * Math.max(0.15, Math.abs(to - from) / span);
    };

    const wake = () => {
      if (raf || !alive) return;
      window.clearTimeout(timer);
      timer = 0;
      raf = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      raf = 0;
      if (!alive) return;
      const s = settingsRef.current!;
      if (s.disabled) {
        state.pos = null;
        draw();
        return;
      }
      if (reduce) {
        state.pos = null;
        draw();
        return;
      }

      if (state.phase === 'sweep') {
        const elapsed = now - state.start;
        const progress = clamp(elapsed / state.duration, 0, 1);
        state.pos = state.from + (state.to - state.from) * s.ease(progress);
        if (progress >= 1) {
          state.pos = state.to;
          if (s.trigger === 'loop') {
            state.phase = 'wait';
            timer = window.setTimeout(() => {
              if (!alive) return;
              if (s.yoyo) {
                state.flip = !state.flip;
                sweep(state.flip ? exit() : entry(), state.flip ? entry() : exit(), performance.now());
              } else {
                sweep(entry(), exit(), performance.now());
              }
              wake();
            }, s.delay * 1000);
          } else {
            state.phase = 'idle';
          }
        }
      }

      draw();
      if (state.phase === 'sweep' || (s.trigger === 'loop' && state.phase !== 'idle')) {
        raf = requestAnimationFrame(tick);
      }
    };

    wake();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <span
      ref={rootRef}
      className={className}
      style={{
        position: 'relative',
        display: 'inline-block',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundImage: `linear-gradient(${color}, ${color})`,
        ...style,
      }}
    >
      {content}
      {glow > 0 && (
        <span
          ref={glowRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            filter: 'blur(0.14em)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default ShinyText;
