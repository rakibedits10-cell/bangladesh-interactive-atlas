import React, { useEffect, useRef } from 'react';

interface FireworksBurstProps {
  active: boolean;
  burstKey: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
}

const COLORS = ['#10B981', '#F59E0B', '#38BDF8', '#F43F5E', '#A7F3D0', '#FDE68A'];

export const FireworksBurst: React.FC<FireworksBurstProps> = ({ active, burstKey }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || burstKey <= 0) return;
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rockets: Rocket[] = [];
    const particles: Particle[] = [];

    const spawnBurst = (cx: number, cy: number, color: string) => {
      const count = 56;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.14;
        const speed = 1.8 + Math.random() * 4.8;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.012,
          color: Math.random() > 0.25 ? color : '#FFFFFF',
          size: 1.8 + Math.random() * 1.8,
        });
      }
    };

    const launchRocket = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      rockets.push({
        x: w * (0.14 + Math.random() * 0.72),
        y: h + 12,
        vy: -(8.5 + Math.random() * 4.5),
        targetY: h * (0.14 + Math.random() * 0.34),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    };

    // Immediate opening salvo + rhythmic waves
    spawnBurst(window.innerWidth * 0.28, window.innerHeight * 0.28, '#10B981');
    spawnBurst(window.innerWidth * 0.72, window.innerHeight * 0.25, '#F59E0B');

    const startTime = performance.now();
    let lastLaunch = 0;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (elapsed < 4200 && now - lastLaunch > 420) {
        launchRocket();
        if (elapsed < 2200 && Math.random() > 0.45) {
          launchRocket();
        }
        lastLaunch = now;
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy += 0.12;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = r.color;
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -1.2) {
          spawnBurst(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.065;
        p.vx *= 0.985;
        p.alpha -= p.decay;

        if (p.alpha <= 0.01) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      if (elapsed < 5800 || rockets.length > 0 || particles.length > 0) {
        rafId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [active, burstKey]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
};
