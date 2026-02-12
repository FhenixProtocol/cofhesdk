import { CofheProvider, useInternalQueryClient } from '@cofhe/react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { usePublicClient, useWalletClient } from 'wagmi';

function QueryDebug() {
  const cofheQueryClient = useInternalQueryClient();
  return <ReactQueryDevtools client={cofheQueryClient} position="left" buttonPosition="bottom-left" />;
}

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const wagmiPublicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();
  return (
    <CofheProvider walletClient={wagmiWalletClient} publicClient={wagmiPublicClient}>
      {children}
      <QueryDebug />
    </CofheProvider>
  );
};
