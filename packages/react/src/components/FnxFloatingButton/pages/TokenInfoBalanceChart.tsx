import { useMemo } from 'react';

import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';

import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';
import { useCofheTokenDecryptedBalance } from '@/hooks';
import { useCofheAccount } from '@/hooks/useCofheConnection';

import { TokenIcon } from '../components/TokenIcon';
import { TokenPriceChart, type TokenPriceChartPoint } from '../components/TokenPriceChart';
import { LoadingDots } from '../components/LoadingDots';
import { CofheTokenConfidentialBalance } from '../components/CofheTokenConfidentialBalance';

import type { Token } from '@/types/token';

interface TokenInfoBalanceChartProps {
  token: Token;
  chartPoints: TokenPriceChartPoint[];
}

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const TokenInfoBalanceChart: React.FC<TokenInfoBalanceChartProps> = ({ token, chartPoints }) => {
  const account = useCofheAccount();

  const { data: publicBalance, isFetching: isFetchingPublicBalance } = useCofheTokenPublicBalance({ token });

  const { data: confidentialBalance, isFetching: isFetchingConfidentialBalance } = useCofheTokenDecryptedBalance({
    accountAddress: account,
    token,
  });

  const isFetchingBalances = isFetchingConfidentialBalance || isFetchingPublicBalance;

  const balancePercents = useMemo(() => {
    if (!confidentialBalance && !publicBalance) return;

    const confidentialUnit = confidentialBalance?.unit ?? null;
    const publicUnit = publicBalance?.unit ?? null;

    const totalUnit = (confidentialUnit?.plus(publicUnit ?? 0) ?? publicUnit)?.toNumber() ?? 0;

    const confidentialPct =
      totalUnit && totalUnit > 0 && confidentialUnit
        ? parseInt(confidentialUnit.div(totalUnit).times(100).toFixed(2))
        : 0;

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
    <>
      {/* Token summary */}
      <div className="p-3">
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
                  {isFetchingBalances ? (
                    <LoadingDots size="sm" variant="secondary" />
                  ) : !balancePercents ? (
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
                  {isFetchingBalances ? (
                    <LoadingDots size="sm" variant="secondary" />
                  ) : !balancePercents ? (
                    <span>--%</span>
                  ) : (
                    <span>{balancePercents.publicPct}%</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <CofheTokenConfidentialBalance token={token} size="lg" decimalPrecision={5} className="font-bold" />
            {price && (
              <div className="flex flex-row">
                <p className="text-xxs ">{money(price.valueUsd)}</p>
                <p className="text-xxs fnx-text-primary">
                  <span>
                    ({price.changeUsd > 0 ? '+' : ''} {price.changePct.toFixed(2)}%)
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price + chart */}
      <div className="space-y-2">
        {price && (
          <div className="flex items-end justify-between">
            <div></div>
            <div className="text-xxxs opacity-60">Last 24h</div>
          </div>
        )}

        <div className="p-3">
          <TokenPriceChart points={chartPoints} />
        </div>
      </div>
    </>
  );
};
