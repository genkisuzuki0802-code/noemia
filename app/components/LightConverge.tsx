"use client";

type Props = {
  progress: number;
  ready: boolean;
};

const CENTER_X = 600;
const CENTER_Y = 380;
const RING_RADIUS = 170;
const LINE_COUNT = 14;

// Fixed, deterministic per-line variation (no Math.random — must match on
// server and client render).
const CHAOS_OFFSET = [
  18, -25, 32, -12, 9, -30, 22, -18, 5, -22, 28, -8, 15, -34,
];
const CHAOS_RADIUS = [
  60, 110, 30, 140, 80, 20, 100, 50, 130, 70, 40, 120, 90, 25,
];
const SPAN_START = [10, 14, 8, 16, 12, 9, 15, 11, 13, 8, 16, 10, 12, 9];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const span = endDeg - startDeg;
  const largeArc = Math.abs(span) > 180 ? 1 : 0;
  const sweep = span >= 0 ? 1 : 0;

  return `M ${start.x.toFixed(2)},${start.y.toFixed(2)} A ${r.toFixed(2)},${r.toFixed(2)} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
}

export default function LightConverge({ progress, ready }: Props) {
  const p = Math.min(1, Math.max(0, progress));
  const ringSpan = 360 / LINE_COUNT + 2;

  const lines = Array.from({ length: LINE_COUNT }, (_, i) => {
    const baseAngle = i * (360 / LINE_COUNT);
    const angle = baseAngle + CHAOS_OFFSET[i] * (1 - p);
    const radius = RING_RADIUS + CHAOS_RADIUS[i] * (1 - p);
    const span = SPAN_START[i] + (ringSpan - SPAN_START[i]) * p;

    return {
      id: i,
      d: arcPath(CENTER_X, CENTER_Y, radius, angle - span / 2, angle + span / 2),
      opacity: 0.35 + p * 0.55,
      strokeWidth: 1.6 + p * 1.2,
    };
  });

  return (
    <div
      className={`converge${ready ? " converge-ready" : ""}`}
      aria-hidden="true"
    >
      <svg
        className="converge-svg"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="converge-line"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#7ee8ff" />
            <stop offset="55%" stopColor="#8f8bff" />
            <stop offset="100%" stopColor="#c98bff" />
          </linearGradient>

          <radialGradient id="converge-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eafcff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#9fd6ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8f8bff" stopOpacity="0" />
          </radialGradient>

          <filter
            id="converge-glow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="converge-lines">
          {lines.map((line) => (
            <path
              key={line.id}
              d={line.d}
              fill="none"
              stroke="url(#converge-line)"
              strokeWidth={line.strokeWidth}
              strokeLinecap="round"
              opacity={line.opacity}
              filter="url(#converge-glow)"
            />
          ))}
        </g>

        <circle
          className="converge-core"
          cx={CENTER_X}
          cy={CENTER_Y}
          r={18 + p * 70}
          fill="url(#converge-core)"
          opacity={0.15 + p * 0.6}
        />

        {ready && (
          <circle
            key="flare"
            className="converge-flare"
            cx={CENTER_X}
            cy={CENTER_Y}
            r={10}
            fill="url(#converge-core)"
          />
        )}
      </svg>
    </div>
  );
}
