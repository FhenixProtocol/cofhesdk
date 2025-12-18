import { getChainById } from '@cofhe/sdk/chains';
import { cn } from '../../../utils/cn.js';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { ChainIcon } from './ChainIcon.js';

export const ChainSelect: React.FC = () => {
  const { darkMode } = useFnxFloatingButtonContext();
  const chainId = useCofheChainId();

  // Get network name from SDK chains
  const chain = chainId ? getChainById(chainId) : undefined;
  const currentNetwork = chain?.name || 'Eth';

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded fnx-hover-overlay transition-colors',
        'fnx-text-primary text-sm outline-none border fnx-dropdown-border',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      <ChainIcon chainId={chainId} />
      <span className="font-medium">{currentNetwork}</span>
    </div>
  );
};
