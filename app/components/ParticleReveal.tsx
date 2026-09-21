"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  runKey: number;
  children: ReactNode;
};

type Glyph = {
  ox: number;
  oy: number;
  cy: number;
  h: number;
  points: Array<[number, number]>;
};

type Band = {
  refCy: number;
  refH: number;
  glyphs: Glyph[];
  top: number;
  bottom: number;
  doneAt: number;
};

type Particle = {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  delay: number;
};

const STEP = 1.25;
const MAX_PARTICLES = 45000;
const TRAVEL = 1.0;
const JITTER = 0.15;
const SIZE = 1.3;

const glyphCache = new Map<string, Array<[number, number]>>();

function sampleGlyph(
  scratch: CanvasRenderingContext2D,
  font: string,
  ch: string,
  w: number,
  h: number
) {
  const key = `${font}|${ch}|${Math.round(w)}x${Math.round(h)}`;
  const cached = glyphCache.get(key);
  if (cached) return cached;

  const cw = Math.ceil(w) + 4;
  const chh = Math.ceil(h) + 4;

  scratch.canvas.width = cw;
  scratch.canvas.height = chh;
  scratch.clearRect(0, 0, cw, chh);
  scratch.font = font;
  scratch.textBaseline = "middle";
  scratch.fillStyle = "#fff";
  scratch.fillText(ch, 2, chh / 2);

  const { data } = scratch.getImageData(0, 0, cw, chh);
  const points: Array<[number, number]> = [];

  for (let y = 0; y < chh; y += STEP) {
    for (let x = 0; x < cw; x += STEP) {
      if (data[(Math.floor(y) * cw + Math.floor(x)) * 4 + 3] > 110) {
        points.push([x - 2, y - chh / 2 + h / 2]);
      }
    }
  }

  glyphCache.set(key, points);

  return points;
}

export default function ParticleReveal({ runKey, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    const settled = settledRef.current;
    const live = liveRef.current;

    if (!wrap || !content || !settled || !live) return;

    const settledCtx = settled.getContext("2d");
    const liveCtx = live.getContext("2d");
    const scratchCtx = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });

    const setMask = (front: number | null) => {
      const value =
        front === null
          ? ""
          : `linear-gradient(to bottom, #000 ${front}px, transparent ${front + 1}px)`;

      content.style.maskImage = value;
      content.style.webkitMaskImage = value;
    };

    const clearAll = () => {
      setMask(null);
      settledCtx?.clearRect(0, 0, settled.width, settled.height);
      liveCtx?.clearRect(0, 0, live.width, live.height);
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (
      !runKey ||
      reducedMotion ||
      !settledCtx ||
      !liveCtx ||
      !scratchCtx
    ) {
      clearAll();
      return;
    }

    setMask(0);

    const wrapRect = wrap.getBoundingClientRect();
    const width = Math.ceil(wrapRect.width);
    const height = Math.ceil(wrapRect.height);

    for (const c of [settled, live]) {
      c.width = width;
      c.height = height;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
    }

    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_TEXT
    );

    const glyphs: Glyph[] = [];
    const range = document.createRange();

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      const text = node.textContent ?? "";

      if (!parent || !text.trim()) continue;

      const cs = getComputedStyle(parent);
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

      for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i) ?? 0;
        const len = cp > 0xffff ? 2 : 1;
        const ch = text.slice(i, i + len);

        if (ch.trim()) {
          range.setStart(node, i);
          range.setEnd(node, i + len);

          const rect = range.getClientRects()[0];

          if (rect && rect.width > 0 && rect.height > 0) {
            const oy = rect.top - wrapRect.top;

            glyphs.push({
              ox: rect.left - wrapRect.left,
              oy,
              cy: oy + rect.height / 2,
              h: rect.height,
              points: sampleGlyph(
                scratchCtx,
                font,
                ch,
                rect.width,
                rect.height
              ),
            });
          }
        }

        i += len;
      }
    }

    if (glyphs.length === 0) {
      clearAll();
      return;
    }

    // Group glyphs into visual rows so that text is revealed top-to-bottom,
    // left-to-right regardless of DOM order (e.g. table cells).
    glyphs.sort((a, b) => a.cy - b.cy);

    const bands: Band[] = [];
    let current: Band | null = null;

    for (const g of glyphs) {
      if (!current || g.cy - current.refCy > current.refH * 0.6) {
        current = {
          refCy: g.cy,
          refH: g.h,
          glyphs: [],
          top: g.oy,
          bottom: g.oy + g.h,
          doneAt: 0,
        };
        bands.push(current);
      }

      current.glyphs.push(g);
      current.top = Math.min(current.top, g.oy);
      current.bottom = Math.max(current.bottom, g.oy + g.h);
    }

    const total = glyphs.length;
    const spread = Math.min(4.5, Math.max(1.8, total * 0.004));

    const raw: Array<{ g: Glyph; delay: number }> = [];
    let rank = 0;

    for (const band of bands) {
      band.glyphs.sort((a, b) => a.ox - b.ox);

      for (const g of band.glyphs) {
        raw.push({ g, delay: (rank / total) * spread });
        rank += 1;
      }

      band.doneAt =
        ((rank - 1) / total) * spread + JITTER + TRAVEL;
    }

    let pointCount = 0;
    for (const r of raw) pointCount += r.g.points.length;

    const keep = Math.min(1, MAX_PARTICLES / pointCount);
    const particles: Particle[] = [];

    for (const { g, delay } of raw) {
      for (const [dx, dy] of g.points) {
        if (keep < 1 && Math.random() > keep) continue;

        const tx = g.ox + dx;
        const ty = g.oy + dy;

        particles.push({
          tx,
          ty,
          sx: width + 40 + Math.random() * 220,
          sy: ty + (Math.random() - 0.5) * 90,
          delay: delay + Math.random() * JITTER,
        });
      }
    }

    particles.sort((a, b) => a.delay - b.delay);

    let frame = 0;
    let index = 0;
    let bandIndex = 0;
    const active: Particle[] = [];
    const start = performance.now();

    function step(now: number) {
      const t = (now - start) / 1000;

      while (index < particles.length && particles[index].delay <= t) {
        active.push(particles[index]);
        index += 1;
      }

      liveCtx!.clearRect(0, 0, width, height);
      liveCtx!.fillStyle = "rgba(238,246,255,0.95)";
      settledCtx!.fillStyle = "rgba(238,246,255,0.95)";

      for (let i = active.length - 1; i >= 0; i--) {
        const p = active[i];
        const k = (t - p.delay) / TRAVEL;

        if (k >= 1) {
          settledCtx!.fillRect(p.tx, p.ty, SIZE, SIZE);
          active[i] = active[active.length - 1];
          active.pop();
          continue;
        }

        const e = 1 - Math.pow(1 - k, 3);

        liveCtx!.fillRect(
          p.sx + (p.tx - p.sx) * e,
          p.sy + (p.ty - p.sy) * e,
          SIZE,
          SIZE
        );
      }

      let front = -1;

      while (bandIndex < bands.length && t >= bands[bandIndex].doneAt) {
        const band = bands[bandIndex];
        const next = bands[bandIndex + 1];

        front = next ? (band.bottom + next.top) / 2 : height;
        bandIndex += 1;
      }

      if (front >= 0) {
        setMask(front);
        settledCtx!.clearRect(0, 0, width, front);
      }

      if (bandIndex >= bands.length) {
        clearAll();
        return;
      }

      frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);

    const onResize = () => {
      cancelAnimationFrame(frame);
      clearAll();
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      clearAll();
    };
  }, [runKey]);

  return (
    <div className="particle-reveal" ref={wrapRef}>
      <div ref={contentRef}>{children}</div>

      <canvas
        ref={settledRef}
        className="particle-canvas"
        aria-hidden="true"
      />

      <canvas
        ref={liveRef}
        className="particle-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
