import { CofheProvider } from '@cofhe/react';
import { useDynamicCofheConfigContext } from './dynamicCofheConfig';
import { usePairForCofhe } from './usePairForCofhe';
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const dynamicConfig = useDynamicCofheConfigContext();
  const pairForCofhe = usePairForCofhe();
  return (
    <CofheProvider
      config={dynamicConfig.resultingConfig}
      autoConnect={{
        walletClient: pairForCofhe.walletClient,
        publicClient: pairForCofhe.publicClient,
      }}
    >
      {children}
    </CofheProvider>
  );
};
