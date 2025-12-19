import { getChainById } from '@cofhe/sdk/chains';
import { ChainIcon } from './ChainIcon';
import { cn } from '@/utils/cn';
import { useCofheChainId } from '@/hooks/useCofheConnection';

export const ChainSelected: React.FC = () => {
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
