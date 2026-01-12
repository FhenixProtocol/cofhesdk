import { CofheProvider } from '@cofhe/react';
import { useClientsForCofheConnection } from './useClientsForCofheConnection';
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const { walletClient, publicClient } = useClientsForCofheConnection();
  return (
    <CofheProvider walletClient={walletClient} publicClient={publicClient}>
      {children}
    </CofheProvider>
  );
};
