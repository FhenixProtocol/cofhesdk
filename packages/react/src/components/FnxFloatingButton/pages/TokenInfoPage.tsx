import type { Token } from '@/types/token';
import { useCoingeckoContractMarketChartRange } from '@/hooks';
import { FloatingButtonPage } from '../pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { sepolia } from '@cofhe/sdk/chains';
import { TMP_WBTC_ON_MAINNET } from '@/utils/coingecko';
import { useMemo } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { Button } from '../components/Button';
import { PageContainer } from '../components/PageContainer';
import { TokenInfoBalanceChart } from './TokenInfoBalanceChart';
import { TokenInfoTransactionHistory, TokenInfoTransactionHistoryHeader } from './TokenInfoTransactionHistory';

type TokenInfoPageProps = {
  token: Token;
};

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.TokenInfo]: TokenInfoPageProps;
  }
}

export const TokenInfoPage: React.FC<TokenInfoPageProps> = ({ token }) => {
  const { navigateBack, navigateTo } = usePortalNavigation();

  const { data: chartPoints } = useCoingeckoContractMarketChartRange({
    ...(token.chainId === sepolia.id
      ? {
          chainId: TMP_WBTC_ON_MAINNET.chainId,
          contractAddress: TMP_WBTC_ON_MAINNET.address,
        }
      : {
          chainId: token.chainId,
          contractAddress: token.extensions.fhenix.erc20Pair?.address,
        }),
    rangeMs: 24 * 3600_000,
  });

  const priceUsd = useMemo(() => {
    const lastPoint = chartPoints?.[chartPoints.length - 1];
    return lastPoint?.value;
  }, [chartPoints]);

  return (
    <PageContainer
      header={
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={navigateBack}
              className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
            >
              <ArrowBackIcon style={{ fontSize: 16 }} />
              <div className="flex flex-col leading-tight">
                <p className="text-sm font-medium">Tokens list</p>
              </div>
            </button>
          </div>

          <TokenInfoBalanceChart token={token} chartPoints={chartPoints ?? []} />

          <TokenInfoTransactionHistoryHeader token={token} />
        </>
      }
      content={<TokenInfoTransactionHistory token={token} priceUsd={priceUsd} />}
      footer={
        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            label="Unshield"
            onClick={() =>
              navigateTo(FloatingButtonPage.Shield, {
                pageProps: {
                  token,
                  defaultMode: 'unshield',
                },
              })
            }
          />
          <Button
            variant="outline"
            className="flex-1"
            label="Send"
            onClick={() => navigateTo(FloatingButtonPage.Send, { pageProps: { token } })}
          />
        </div>
      }
    />
  );
};
