import { useMemo } from "react";

export function Background() {
  const { lightPools } = useMemo(() => {
    // 3-5 subtle "light pool" gradients for geography
    const pools = [
      { cx: 800, cy: 600, r: 500 },
      { cx: 2200, cy: 1400, r: 400 },
      { cx: 1400, cy: 2600, r: 450 },
      { cx: 3000, cy: 800, r: 350 },
    ];
    return { lightPools: pools };
  }, []);

  return (
    <svg
      style={{
        position: "absolute",
        top: -2000,
        left: -2000,
        width: 4000,
        height: 4000,
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Dot grid pattern — 1px dots, 24px apart, very faint */}
        <pattern
          id="dot-grid"
          x="0"
          y="0"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="12" cy="12" r="1.2" fill="white" opacity="0.55" />
        </pattern>

        {/* Radial gradient for light pools */}
        {lightPools.map((pool, i) => (
          <radialGradient key={`pool-grad-${i}`} id={`pool-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.02" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {/* Layer 1: Dot grid */}
      <rect x="0" y="0" width="4000" height="4000" fill="url(#dot-grid)" />

      {/* Layer 2: Subtle light pools */}
      {lightPools.map((pool, i) => (
        <circle
          key={`pool-${i}`}
          cx={pool.cx}
          cy={pool.cy}
          r={pool.r}
          fill={`url(#pool-${i})`}
        />
      ))}
    </svg>
  );
}
