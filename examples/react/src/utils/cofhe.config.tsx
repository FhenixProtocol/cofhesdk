import { CofheProvider } from '@cofhe/react';
import { useDynamicCofheConfigContext } from './dynamicCofheConfig';
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const dynamicConfig = useDynamicCofheConfigContext();
  return <CofheProvider config={dynamicConfig.resultingConfig}>{children}</CofheProvider>;
};
