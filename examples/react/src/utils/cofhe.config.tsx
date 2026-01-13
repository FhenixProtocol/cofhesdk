import { CofheProvider, useInternalQueryClient } from '@cofhe/react';
import { useClientsForCofheConnection } from './useClientsForCofheConnection';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function QueryDebug() {
  const cofheQueryClient = useInternalQueryClient();
  return <ReactQueryDevtools client={cofheQueryClient} position="left" buttonPosition="bottom-left" />;
}

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const { walletClient, publicClient } = useClientsForCofheConnection();
  return (
    <CofheProvider walletClient={walletClient} publicClient={publicClient}>
      {children}
      <QueryDebug />
    </CofheProvider>
  );
};
