"use client";

export default function BrandTitle() {
  return (
    <div className="brand-title" aria-hidden="true">
      <svg
        className="brand-title-svg"
        width="230"
        height="56"
        viewBox="0 0 230 56"
        overflow="visible"
      >
        <defs>
          <linearGradient
            id="brand-line"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#7ee8ff" />
            <stop offset="55%" stopColor="#8f8bff" />
            <stop offset="100%" stopColor="#c98bff" />
          </linearGradient>

          <filter
            id="brand-glow"
            x="-40%"
            y="-100%"
            width="180%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <text
          x="4"
          y="40"
          className="brand-title-text"
          fontSize="34"
          fontWeight={750}
          letterSpacing="-0.8"
          fill="none"
          stroke="url(#brand-line)"
          strokeWidth="1.3"
          filter="url(#brand-glow)"
        >
          Noemia
        </text>
      </svg>
    </div>
  );
}
