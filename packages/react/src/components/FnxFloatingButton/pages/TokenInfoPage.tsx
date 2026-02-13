import { useEffect, useState } from 'react';

import { type Token } from '@/hooks/useCofheTokenLists';
import { FloatingButtonPage } from '../pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { TokenDetailsView } from '../components/TokenDetailsView';
import type { TokenPriceChartPoint } from '../components/TokenPriceChart';

type TokenInfoPageProps = {
  token: Token;
};

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.TokenInfo]: TokenInfoPageProps;
  }
}

export const TokenInfoPage: React.FC<TokenInfoPageProps> = ({ token }) => {
  const { navigateBack } = usePortalNavigation();

  const [chartPoints, setChartPoints] = useState<TokenPriceChartPoint[] | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const platformIdByChainId: Record<number, string> = {
      1: 'ethereum',
      10: 'optimistic-ethereum',
      42161: 'arbitrum-one',
      8453: 'base',
      137: 'polygon-pos',
      56: 'binance-smart-chain',
    };

    const platformId = platformIdByChainId[token.chainId];
    if (!platformId) return;

    const from = Math.floor((Date.now() - 24 * 3600_000) / 1000);
    const to = Math.floor(Date.now() / 1000);
    const url = `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${token.extensions.fhenix.erc20Pair?.address}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;

    (async () => {
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) return;
        const json = (await res.json()) as { prices?: Array<[number, number]> };
        const prices = json.prices ?? [];
        if (prices.length < 2) return;
        const pts: TokenPriceChartPoint[] = prices
          .map(([ts, value]) => ({ ts, value }))
          .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value));
        if (pts.length < 2) return;
        setChartPoints(pts);
      } catch {
        // ignore and let TokenDetailsView fall back to dummy chart
      }
    })();

    return () => controller.abort();
  }, [token.chainId, token.extensions.fhenix.erc20Pair?.address]);

  return <TokenDetailsView token={token} onBack={navigateBack} chartPoints={chartPoints} />;
};
