import { useMemo, type ReactNode } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { cn } from '@/utils/cn';
import type { Token } from '@/types/token';

import { Button } from './Button';
import { Card } from './Card';
import { CofheTokenConfidentialBalance } from './CofheTokenConfidentialBalance';
import { HashLink } from './HashLink';
import { TokenIcon } from './TokenIcon';
import { PageContainer } from './PageContainer';
import { TokenPriceChart, type TokenPriceChartPoint } from './TokenPriceChart';

export interface TokenDetailsPrice {
  valueUsd: number;
  changeUsd: number;
  changePct: number;
}

export interface TokenDetailsActivityItem {
  kind: string;
  from: string;
  amountUsd: number;
  amountToken: number;
  leftIcon?: ReactNode;
}

export interface TokenDetailsResources {
  ferc20Address: `0x${string}`;
  website: string;
  whitepaper: string;
}

export interface TokenDetailsViewProps {
  token: Token;
  onBack?: () => void;
  onAddCustomToken?: () => void;
  onUnshield?: () => void;
  onSend?: () => void;

  price?: TokenDetailsPrice;
  chartPoints: TokenPriceChartPoint[];
  activity?: TokenDetailsActivityItem[];
  resources?: TokenDetailsResources;
  disclaimer?: string;
}

const defaultActivity: TokenDetailsActivityItem[] = [
  { kind: 'Received', from: '0xGBDZb25042...', amountUsd: 1000, amountToken: 0.23 },
  { kind: 'Sent', from: '0xGBDZb25042...', amountUsd: 1000, amountToken: 0.23 },
  { kind: 'Claimed', from: '0xGBDZb25042...', amountUsd: 1000, amountToken: 0.23 },
];

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const TokenDetailsView: React.FC<TokenDetailsViewProps> = ({
  token,
  onBack,
  onAddCustomToken,
  onUnshield,
  onSend,
  // price = defaultPrice,
  chartPoints,
  activity = defaultActivity,
}) => {
  const price = useMemo(() => {
    const lastPoint = chartPoints?.[chartPoints.length - 1];
    const firstPoint = chartPoints?.[0];

    if (!lastPoint || !firstPoint) return;

    return {
      valueUsd: lastPoint.value,
      changeUsd: lastPoint.value - firstPoint.value,
      changePct: ((lastPoint.value - firstPoint.value) / firstPoint.value) * 100,
    };
  }, [chartPoints]);
  return (
    <PageContainer
      header={
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
            >
              <ArrowBackIcon style={{ fontSize: 16 }} />
              <div className="flex flex-col leading-tight">
                <p className="text-sm font-medium">Tokens list</p>
                <p className="text-xxxs opacity-70">{token.name}</p>
              </div>
            </button>

            <Button
              variant="outline"
              size="sm"
              label="Add custom Token +"
              onClick={onAddCustomToken}
              disabled={!onAddCustomToken}
            />
          </div>
          {/* Token summary */}
          <Card className="p-3" padded={false}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TokenIcon logoURI={token.logoURI} alt={token.name} size="md" />
                <div className="flex flex-col leading-tight">
                  <p className="text-sm font-bold fnx-text-primary">{token.symbol}</p>
                  <p className="text-xxxs opacity-70">{token.name}</p>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <CofheTokenConfidentialBalance token={token} size="lg" decimalPrecision={5} className="font-bold" />
                {price && (
                  <div className="flex flex-row">
                    <p className="text-xxxs opacity-60">{money(price.valueUsd)}</p>
                    <p className="text-xxxs fnx-text-primary opacity-70">
                      <span className="mr-2">
                        {
                          price.changeUsd > 0 ? '+' : '' // show sign for positive changes
                        }
                        {money(price.changeUsd)}
                      </span>
                      <span>({price.changePct.toFixed(2)}%)</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
          {/* Price + chart */}
          <div className="space-y-2">
            {price && (
              <div className="flex items-end justify-between">
                <div></div>
                <div className="text-xxxs opacity-60">Last 24h</div>
              </div>
            )}

            <Card className="p-3" padded={false}>
              <TokenPriceChart points={chartPoints} />
            </Card>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold fnx-text-primary">Activity</h3>
            <HashLink type="token" hash={token.address} chainId={token.chainId} extraShort />
            {token.extensions.fhenix.erc20Pair?.address && (
              <HashLink
                type="token"
                hash={token.extensions.fhenix.erc20Pair.address}
                chainId={token.chainId}
                extraShort
              />
            )}
          </div>
        </>
      }
      content={
        <>
          {/* Activity */}
          <div className="space-y-2">
            <Card className="p-3" padded={false}>
              <div className="flex flex-col gap-3">
                {activity.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {item.leftIcon ?? (
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full',
                            'bg-cyan-200/70 dark:bg-cyan-900/40',
                            'flex items-center justify-center'
                          )}
                        />
                      )}
                      <div className="flex flex-col">
                        <p className="text-sm font-bold fnx-text-primary">{item.kind}</p>
                        <p className="text-xxxs opacity-70">from: {item.from}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <p className="text-sm font-bold fnx-text-primary">{money(item.amountUsd)}</p>
                      <p className="text-xxxs opacity-70">
                        {item.amountToken} {token.symbol}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      }
      footer={
        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" label="Unshield" onClick={onUnshield} disabled={!onUnshield} />
          <Button variant="outline" className="flex-1" label="Send" onClick={onSend} disabled={!onSend} />
        </div>
      }
    />
  );
};
