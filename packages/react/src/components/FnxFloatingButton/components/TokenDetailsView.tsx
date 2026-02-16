import { useMemo, type ReactNode } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';

import { cn } from '@/utils/cn';
import type { Token } from '@/types/token';

import { Button } from './Button';
import { Card } from './Card';
import { HashLink } from './HashLink';
import { TokenIcon } from './TokenIcon';
import { PageContainer } from './PageContainer';
import { TokenPriceChart, type TokenPriceChartPoint } from './TokenPriceChart';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';
import { useCofheTokenDecryptedBalance } from '@/hooks';
import { LoadingDots } from './LoadingDots';
import { CofheTokenConfidentialBalance } from './CofheTokenConfidentialBalance';
import { useCofheAccount } from '@/hooks/useCofheConnection';

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
  onUnshield,
  onSend,
  // price = defaultPrice,
  chartPoints,
  activity = defaultActivity,
}) => {
  const { data: publicBalance, isFetching: isFetchingPublicBalance } = useCofheTokenPublicBalance({
    token,
  });

  const account = useCofheAccount();

  const { data: confidentialBalance, isFetching: isFetchingConfidentialBalance } = useCofheTokenDecryptedBalance({
    accountAddress: account,
    token,
  });

  const balancePercents = useMemo(() => {
    const totalUnit = confidentialBalance?.unit.plus(publicBalance?.unit ?? 0).toNumber();

    const confidentialPct =
      totalUnit && totalUnit > 0 ? parseInt(confidentialBalance!.unit.div(totalUnit).times(100).toFixed(2)) : 0;

    const publicPct = 100 - confidentialPct;

    return {
      confidentialPct,
      publicPct,
    };
  }, [confidentialBalance, publicBalance]);

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
              </div>
            </button>
          </div>
          {/* Token summary */}
          <Card className="p-3" padded={false}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TokenIcon logoURI={token.logoURI} alt={token.extensions.fhenix.erc20Pair?.symbol} size="md" />
                <div className="flex flex-col leading-tight">
                  <p className="text-sm font-bold fnx-text-primary">{token.extensions.fhenix.erc20Pair?.symbol}</p>
                  <div className="flex items-center gap-3 text-xxs opacity-80">
                    <div
                      className="inline-flex items-center gap-1"
                      title="Confidential balance percent"
                      aria-label="Confidential balance percent"
                    >
                      <LockIcon style={{ fontSize: 14 }} />
                      {isFetchingConfidentialBalance || isFetchingPublicBalance ? (
                        <LoadingDots size="sm" variant="secondary" />
                      ) : balancePercents.confidentialPct === null ? (
                        <span>--%</span>
                      ) : (
                        <span>{balancePercents.confidentialPct}%</span>
                      )}
                    </div>

                    <div
                      className="inline-flex items-center gap-1"
                      title="Public balance percent"
                      aria-label="Public balance percent"
                    >
                      <PublicIcon style={{ fontSize: 14 }} />
                      {isFetchingConfidentialBalance || isFetchingPublicBalance ? (
                        <LoadingDots size="sm" variant="secondary" />
                      ) : balancePercents.publicPct === null ? (
                        <span>--%</span>
                      ) : (
                        <span>{balancePercents.publicPct}%</span>
                      )}
                    </div>
                  </div>
                  {/* <p className="text-xxxs opacity-70">{token.name}</p> */}
                </div>
              </div>

              <div className="flex flex-col items-end">
                <CofheTokenConfidentialBalance token={token} size="lg" decimalPrecision={5} className="font-bold" />
                {price && (
                  <div className="flex flex-row">
                    <p className="text-xxs ">{money(price.valueUsd)}</p>
                    <p className="text-xxs fnx-text-primary">
                      <span>
                        (
                        {
                          price.changeUsd > 0 ? '+' : '' // show sign for positive changes
                        }{' '}
                        {price.changePct.toFixed(2)}%)
                      </span>
                      {/* <span className="mr-2">
                        {
                          price.changeUsd > 0 ? '+' : '' // show sign for positive changes
                        }
                        ({money(price.changeUsd)})
                      </span> */}
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
