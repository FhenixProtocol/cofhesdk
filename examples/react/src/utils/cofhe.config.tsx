import { CofheProvider, FnxFloatingButtonWithProvider } from '@cofhe/react';
import { useDynamicCofheConfigContext } from './dynamicCofheConfig';
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const dynamicConfig = useDynamicCofheConfigContext();
  return (
    <CofheProvider config={dynamicConfig.resultingConfig}>
      {/* todo: it should be coupled together internally, not in the app */}
      <FnxFloatingButtonWithProvider>{children}</FnxFloatingButtonWithProvider>
    </CofheProvider>
  );
};
