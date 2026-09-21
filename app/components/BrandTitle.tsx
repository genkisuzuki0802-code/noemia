"use client";

import { useEffect, useRef } from "react";

const IN_DUR = 2.4;
const IN_TRAVEL = 1.6;
const HOLD_DUR = 6;
const OUT_DUR = 2.9;
const OUT_TRAVEL = 1.4;
const GAP_DUR = 3;
const CYCLE = IN_DUR + HOLD_DUR + OUT_DUR + GAP_DUR;

const HEIGHT = 56;
const LEFT_PAD = 28;
const TEXT_X = LEFT_PAD + 4;
const TEXT_BASELINE = 40;
const FONT =
  '700 34px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans JP", sans-serif';
const STEP = 1.5;
const SIZE = 1.6;

const STOPS = [
  [126, 232, 255],
  [143, 139, 255],
  [201, 139, 255],
];

type Particle = {
  tx: number;
  ty: number;
  rgb: string;
  startDx: number;
  startDy: number;
  inDelay: number;
  outDelay: number;
  outDist: number;
  outDy: number;
  phase: number;
};

function colorAt(t: number) {
  const seg = t < 0.5 ? 0 : 1;
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = STOPS[seg];
  const b = STOPS[seg + 1];
  return [0, 1, 2]
    .map((i) => Math.round(a[i] + (b[i] - a[i]) * local))
    .join(",");
}

function buildParticles(): Particle[] {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return [];

  probe.font = FONT;
  const textWidth = Math.ceil(probe.measureText("Noemia").width);

  const off = document.createElement("canvas");
  off.width = TEXT_X + textWidth + 8;
  off.height = HEIGHT;

  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return [];

  octx.font = FONT;
  octx.fillStyle = "#fff";
  octx.fillText("Noemia", TEXT_X, TEXT_BASELINE);

  const { data, width, height } = octx.getImageData(
    0,
    0,
    off.width,
    off.height
  );

  const particles: Particle[] = [];

  for (let y = 0; y < height; y += STEP) {
    for (let x = TEXT_X - 2; x < width; x += STEP) {
      const alpha =
        data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3];

      if (alpha < 128) continue;

      const progress = Math.min(
        1,
        Math.max(0, (x - TEXT_X) / textWidth)
      );

      particles.push({
        tx: x,
        ty: y,
        rgb: colorAt(progress),
        startDx: Math.random() * 140,
        startDy: (Math.random() - 0.5) * 70,
        inDelay: Math.random() * (IN_DUR - IN_TRAVEL),
        outDelay:
          progress * (OUT_DUR - OUT_TRAVEL - 0.2) +
          Math.random() * 0.2,
        outDist: 110 + Math.random() * 160,
        outDy: (Math.random() - 0.5) * 50,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  return particles;
}

export default function BrandTitle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles = buildParticles();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let frame = 0;
    let startTime = 0;

    function resize() {
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function render(t: number) {
      if (!ctx) return;

      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.globalCompositeOperation = "lighter";

      const holdEnd = IN_DUR + HOLD_DUR;
      const outEnd = holdEnd + OUT_DUR;

      for (const p of particles) {
        let x = p.tx;
        let y = p.ty;
        let alpha = 0.95;

        if (t < IN_DUR) {
          const raw = (t - p.inDelay) / IN_TRAVEL;
          if (raw <= 0) continue;

          const k = Math.min(1, raw);
          const e = 1 - Math.pow(1 - k, 3);
          const sx = width + p.startDx;
          const sy = p.ty + p.startDy;

          x = sx + (p.tx - sx) * e;
          y =
            sy +
            (p.ty - sy) * e +
            Math.sin(k * Math.PI * 2 + p.phase) * (1 - k) * 6;
          alpha = Math.min(0.95, k * 4);
        } else if (t < holdEnd) {
          x = p.tx + Math.sin(t * 1.6 + p.phase) * 0.35;
          y = p.ty + Math.cos(t * 1.3 + p.phase) * 0.35;
        } else if (t < outEnd) {
          const u = t - holdEnd;
          const k = Math.min(
            1,
            Math.max(0, (u - p.outDelay) / OUT_TRAVEL)
          );

          if (k >= 1) continue;

          const e = k * k;

          x = p.tx - p.outDist * e;
          y =
            p.ty +
            p.outDy * e +
            Math.sin(k * Math.PI * 3 + p.phase) * 3 * k;
          alpha = 0.95 * (1 - k);
        } else {
          continue;
        }

        ctx.fillStyle = `rgba(${p.rgb},${alpha.toFixed(3)})`;
        ctx.fillRect(x, y, SIZE, SIZE);
      }
    }

    function loop(now: number) {
      if (!startTime) startTime = now;

      render(((now - startTime) / 1000) % CYCLE);
      frame = requestAnimationFrame(loop);
    }

    resize();

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) render(IN_DUR + 1);
    });

    observer.observe(canvas);

    if (reducedMotion) {
      render(IN_DUR + 1);
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="brand-title" aria-hidden="true">
      <canvas ref={canvasRef} className="brand-title-canvas" />
    </div>
  );
}
