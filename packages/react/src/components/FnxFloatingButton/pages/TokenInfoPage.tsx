import { type Token } from '@/hooks/useCofheTokenLists';
import { useCoingeckoContractMarketChartRange } from '@/hooks';
import { FloatingButtonPage } from '../pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { TokenDetailsView } from '../components/TokenDetailsView';
import { sepolia } from '@cofhe/sdk/chains';
import { TMP_WBTC_ON_MAINNET } from '@/utils/coingecko';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';
import { useCofheTokenDecryptedBalance } from '@/hooks';
import { useCofheAccount } from '@/hooks/useCofheConnection';
import { useMemo } from 'react';
import { useStoredTransactions } from '@/hooks/useStoredTransactions.js';
import { actionToString } from '@/stores/transactionStore';
import { formatUnits } from 'viem';

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

  const { data: publicBalance, isFetching: isFetchingPublicBalance } = useCofheTokenPublicBalance({
    token,
  });

  const account = useCofheAccount();
  const { data: confidentialBalance, isFetching: isFetchingConfidentialBalance } = useCofheTokenDecryptedBalance({
    accountAddress: account,
    token,
  });

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

  const { filteredTxs: tokenTxs } = useStoredTransactions({
    chainId: token.chainId,
    account,
    filter: (tx) => tx.token.address.toLowerCase() === token.address.toLowerCase(),
  });

  const activity = useMemo(() => {
    const lastPoint = chartPoints?.[chartPoints.length - 1];
    const priceUsd = lastPoint?.value;

    return tokenTxs
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((tx) => {
        const amountToken = parseFloat(formatUnits(tx.tokenAmount, tx.token.decimals));
        const amountUsd =
          typeof priceUsd === 'number' && Number.isFinite(amountToken) ? amountToken * priceUsd : undefined;

        return {
          kind: actionToString(tx.actionType),

          amountUsd,
          amountToken: Number.isFinite(amountToken) ? amountToken : 0,
        };
      });
  }, [tokenTxs, chartPoints]);

  return (
    <TokenDetailsView
      token={token}
      onBack={navigateBack}
      onSend={() => navigateTo(FloatingButtonPage.Send, { pageProps: { token } })}
      onUnshield={() =>
        navigateTo(FloatingButtonPage.Shield, {
          pageProps: {
            token,
            defaultMode: 'unshield',
          },
        })
      }
      balancePercents={balancePercents}
      isFetchingBalances={isFetchingConfidentialBalance || isFetchingPublicBalance}
      chartPoints={chartPoints ?? []}
      activity={activity}
    />
  );
};
