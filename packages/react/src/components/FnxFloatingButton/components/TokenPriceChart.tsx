import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/utils/cn';

export interface TokenPriceChartPoint {
  /** Unix ms */
  ts: number;
  /** Price in USD */
  value: number;
}

export interface TokenPriceChartProps {
  points: TokenPriceChartPoint[];
  className?: string;
  height?: number;
  /** Show last 24h range label row under the chart */
  show24hAxisLabels?: boolean;
}

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

const formatUsd = (n: number): string =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (typeof v !== 'number') return null;

  return (
    <div className="rounded-md border fnx-card-border fnx-card-bg px-2 py-1 shadow-sm">
      <div className="text-xxxs opacity-70">{typeof label === 'number' ? formatTime(label) : ''}</div>
      <div className="text-xs font-semibold fnx-text-primary">{formatUsd(v)}</div>
    </div>
  );
};

export const TokenPriceChart: React.FC<TokenPriceChartProps> = ({
  points,
  className,
  height = 150,
  show24hAxisLabels = true,
}) => {
  const gradientId = useId();

  const { start, mid, end } = useMemo(() => {
    if (!points.length) {
      const now = Date.now();
      return { start: now - 24 * 3600_000, mid: now - 12 * 3600_000, end: now };
    }
    const start = points[0].ts;
    const end = points[points.length - 1].ts;
    const mid = start + (end - start) / 2;
    return { start, mid, end };
  }, [points]);

  return (
    <div className={cn('w-full', className)}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#14B8A6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.25)" strokeDasharray="3 3" />

            <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} hide />
            <YAxis dataKey="value" domain={['dataMin', 'dataMax']} hide />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(20,184,166,0.35)' }} />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#14B8A6"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, stroke: '#14B8A6', strokeWidth: 2, fill: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {show24hAxisLabels && (
        <div className="flex items-center justify-between text-xxxs opacity-60 mt-1">
          <span>{formatTime(start)}</span>
          <span>{formatTime(mid)}</span>
          <span>{formatTime(end)}</span>
        </div>
      )}
    </div>
  );
};
