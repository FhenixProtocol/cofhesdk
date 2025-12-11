import { useEffect, useRef, useMemo } from 'react';

interface ShieldMeterProps {
  /** Percentage value from 0 to 100 */
  percentage: number;
  /** Size of the shield in pixels (default: 120) */
  size?: number;
  /** Whether to show the percentage text (default: true) */
  showPercentage?: boolean;
  /** Custom class name for the wrapper */
  className?: string;
  /** Whether a shield/unshield operation is in progress */
  isProcessing?: boolean;
}

/**
 * Computes RGB color interpolating from red (0%) to green (100%)
 */
const colorFromPercent = (p: number): string => {
  const t = p / 100;
  const r = Math.round(255 * (1 - t)); // red decreases
  const g = Math.round(255 * t); // green increases
  return `rgb(${r},${g},0)`;
};

export const ShieldMeter: React.FC<ShieldMeterProps> = ({
  percentage,
  size = 120,
  showPercentage = true,
  className,
  isProcessing = false,
}) => {
  const meterPathRef = useRef<SVGPathElement>(null);
  const pathLengthRef = useRef<number>(0);

  // Clamp percentage between 0 and 100
  const clampedPercentage = useMemo(() => Math.max(0, Math.min(100, percentage)), [percentage]);

  // Calculate color based on percentage
  const glowColor = useMemo(() => colorFromPercent(clampedPercentage), [clampedPercentage]);

  // Initialize path length on mount
  useEffect(() => {
    if (meterPathRef.current) {
      pathLengthRef.current = meterPathRef.current.getTotalLength();
    }
  }, []);

  // Calculate stroke dash offset for the meter path
  const strokeDashOffset = useMemo(() => {
    if (pathLengthRef.current === 0) return 0;
    const visiblePortion = clampedPercentage / 100;
    return pathLengthRef.current * (1 - visiblePortion);
  }, [clampedPercentage]);

  // The shield path for the meter (starts at bottom, goes around)
  const shieldMeterPath = `
    M50 105
    Q63 99 73 86
    Q84 72 84 55
    L84 26
    Q84 23 82 22
    L50 10
    L18 22
    Q16 23 16 26
    L16 55
    Q16 72 27 86
    Q37 99 50 105
  `;

  // Outer shield path
  const shieldOuterPath = `
    M50 4
    L86 18
    Q90 20 90 26
    L90 56
    Q90 76 77 92
    Q65 108 50 115
    Q35 108 23 92
    Q10 76 10 56
    L10 26
    Q10 20 14 18
    Z
  `;

  // Expanded outer path for processing animation (sits outside the shield)
  // Path starts at bottom and goes clockwise, so any discontinuity is at the less noticeable bottom
  const processingPath = `
    M50 122
    Q33 114 19 98
    Q4 80 4 58
    L4 22
    Q4 16 8 14
    L50 -2
    L92 14
    Q96 16 96 22
    L96 58
    Q96 80 81 98
    Q67 114 50 122
  `;

  // Inner fill path
  const innerFillPath = `
    M50 14
    L79 25
    Q80 26 80 28
    L80 54
    Q80 69 70 81
    Q61 92 50 97
    Q39 92 30 81
    Q20 69 20 54
    L20 28
    Q20 26 21 25
    Z
  `;

  // Approximate path length (calculated from the SVG path)
  const approximatePathLength = 280;

  // Outer path length for processing animation
  const outerPathLength = 320;

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 120"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="shieldInnerGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="50%" stopColor="#020617" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          {/* Gradient for inner shield - light to dark */}
          <linearGradient id="innerShieldGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <filter id="shieldGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="processingGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer shield */}
        <path d={shieldOuterPath} fill="#050816" stroke="#1f2937" strokeWidth={2} />

        {/* Processing animation - running segment around the shield */}
        {isProcessing && (
          <>
            <path
              d={processingPath}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={3}
              strokeLinecap="round"
              filter="url(#processingGlow)"
              style={{
                // Visible segment: 20% of path, Gap: 100% of path (creates natural pause)
                strokeDasharray: `${outerPathLength * 0.2} ${outerPathLength}`,
                animation: 'shieldProcessingRing 1.2s linear infinite',
              }}
            />
            <style>
              {`
                @keyframes shieldProcessingRing {
                  0% {
                    stroke-dashoffset: 0;
                  }
                  100% {
                    stroke-dashoffset: -${outerPathLength * 1.2};
                  }
                }
              `}
            </style>
          </>
        )}

        {/* Inner fill for depth */}
        <path d={innerFillPath} fill="url(#shieldInnerGradient)" opacity={0.9} style={{ pointerEvents: 'none' }} />

        {/* Inner static border (always visible, dark) */}
        <path d={shieldMeterPath} fill="none" stroke="#020617" strokeWidth={3} />

        {/* Meter path: the growing line */}
        <path
          ref={meterPathRef}
          d={shieldMeterPath}
          fill="none"
          stroke={glowColor}
          strokeWidth={3}
          strokeLinecap="round"
          filter="url(#shieldGlow)"
          style={{
            strokeDasharray: approximatePathLength,
            strokeDashoffset: approximatePathLength * (1 - clampedPercentage / 100),
            transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease-out',
          }}
        />

        {/* Inner shield - 50% smaller, red, centered */}
        {/* <g transform="translate(50, 59.5) scale(0.7) translate(-50, -59.5)">
          <path
            d={shieldOuterPath}
            fill="#FFFFFF"
            stroke="#ef4444"
            strokeWidth={4}
          />
        </g> */}

        {/* Percentage text */}
        {showPercentage && (
          <text
            x="50"
            y="62"
            fill="#f9fafb"
            fontSize={18}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {Math.round(clampedPercentage)}%
          </text>
        )}
      </svg>
    </div>
  );
};
