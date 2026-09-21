"use client";

import { useEffect, useRef } from "react";

type Props = {
  boost: boolean;
};

const STAR_COUNT = 320;
const PALETTE = [
  "255,255,255",
  "190,235,255",
  "170,190,255",
  "215,185,255",
];

type Star = {
  x: number;
  y: number;
  z: number;
  rgb: string;
};

function spawn(star: Star, fresh: boolean) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.05 + Math.random() * 1.1;

  star.x = Math.cos(angle) * radius;
  star.y = Math.sin(angle) * radius;
  star.z = fresh ? 0.08 + Math.random() * 0.92 : 0.9 + Math.random() * 0.1;
  star.rgb = PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export default function WarpTunnel({ boost }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boostRef = useRef(boost);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => {
      const star = { x: 0, y: 0, z: 1, rgb: PALETTE[0] };
      spawn(star, true);
      return star;
    });

    let width = 0;
    let height = 0;
    let speed = 0;
    let last = 0;
    let frame = 0;
    let running = false;

    function resize() {
      if (!canvas || !ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function step(now: number) {
      if (!ctx) return;

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const target = boostRef.current ? 1 : 0;
      const rate = target > speed ? 2.6 : 1.8;
      speed += (target - speed) * (1 - Math.exp(-rate * dt));

      if (target === 0 && speed < 0.004) {
        speed = 0;
        ctx.clearRect(0, 0, width, height);
        running = false;
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      const cx = width / 2;
      const cy = height * 0.46;
      const reach = Math.max(width, height) * 0.36;
      const halfDiag = Math.hypot(width, height) / 2;

      const dz = (0.12 + 1.9 * speed * speed) * dt;
      const tail = 2.2 + 8 * speed;
      const visibility = Math.min(1, speed * 1.7);

      for (const star of stars) {
        const prevZ = star.z + dz * tail;

        star.z -= dz;

        const hx = (star.x / star.z) * reach;
        const hy = (star.y / star.z) * reach;

        if (star.z < 0.03 || Math.hypot(hx, hy) > halfDiag) {
          spawn(star, false);
          continue;
        }

        const tx = (star.x / prevZ) * reach;
        const ty = (star.y / prevZ) * reach;

        const depth = 1 - star.z;
        const alpha = Math.min(1, depth * 1.4) * visibility;

        if (alpha < 0.01) continue;

        ctx.strokeStyle = `rgba(${star.rgb},${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.5 + depth * 1.8;
        ctx.beginPath();
        ctx.moveTo(cx + tx, cy + ty);
        ctx.lineTo(cx + hx, cy + hy);
        ctx.stroke();
      }

      frame = requestAnimationFrame(step);
    }

    startRef.current = () => {
      if (reducedMotion || running) return;

      running = true;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    if (boostRef.current) startRef.current();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      running = false;
    };
  }, []);

  useEffect(() => {
    boostRef.current = boost;

    if (boost) startRef.current();
  }, [boost]);

  return (
    <canvas
      ref={canvasRef}
      className="warp-canvas"
      aria-hidden="true"
    />
  );
}
