import { useId, useMemo } from 'react';

import { cn } from '@/utils/cn';

export interface MiniAreaChartPoint {
  x: number;
  y: number;
}

export interface MiniAreaChartProps {
  points: MiniAreaChartPoint[];
  className?: string;
  height?: number;
  strokeWidth?: number;
  /** Shows the last point label (tooltip-like) */
  markerLabel?: string;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const MiniAreaChart: React.FC<MiniAreaChartProps> = ({
  points,
  className,
  height = 140,
  strokeWidth = 2,
  markerLabel,
}) => {
  const gradientId = useId();

  const { dLine, dArea, lastPoint } = useMemo(() => {
    if (!points || points.length < 2) {
      return { dLine: '', dArea: '', lastPoint: undefined as { x: number; y: number } | undefined };
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = 320;
    const padTop = 6;
    const padBottom = 10;
    const usableH = Math.max(1, height - padTop - padBottom);

    const scaleX = (x: number) => {
      const t = maxX === minX ? 0.5 : (x - minX) / (maxX - minX);
      return clamp01(t) * width;
    };

    const scaleY = (y: number) => {
      const t = maxY === minY ? 0.5 : (y - minY) / (maxY - minY);
      // invert for SVG
      return padTop + (1 - clamp01(t)) * usableH;
    };

    const path = points
      .map((p, idx) => {
        const x = scaleX(p.x);
        const y = scaleY(p.y);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    const last = points[points.length - 1];
    const lx = scaleX(last.x);
    const ly = scaleY(last.y);

    const area = `${path} L ${lx.toFixed(2)} ${(height - padBottom).toFixed(2)} L 0 ${(height - padBottom).toFixed(2)} Z`;

    return { dLine: path, dArea: area, lastPoint: { x: lx, y: ly } };
  }, [points, height]);

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 320 ${height}`} width="100%" height={height} className="block">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#5EEAD4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* area */}
        {dArea && <path d={dArea} fill={`url(#${gradientId})`} />}

        {/* line */}
        {dLine && <path d={dLine} fill="none" stroke="#14B8A6" strokeWidth={strokeWidth} />}

        {/* marker */}
        {lastPoint && (
          <>
            <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="#14B8A6" />
            {markerLabel && (
              <g>
                <rect
                  x={Math.min(320 - 64, Math.max(0, lastPoint.x - 26))}
                  y={Math.max(0, lastPoint.y - 28)}
                  width="64"
                  height="20"
                  rx="4"
                  fill="#CFFAFE"
                  stroke="#0EA5A6"
                  strokeWidth="1"
                />
                <text
                  x={Math.min(320 - 32, Math.max(32, lastPoint.x))}
                  y={Math.max(12, lastPoint.y - 14)}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#0F172A"
                  fontFamily="ui-sans-serif, system-ui, -apple-system"
                >
                  {markerLabel}
                </text>
              </g>
            )}
          </>
        )}
      </svg>
    </div>
  );
};
