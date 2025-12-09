import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { getChainById, type CofheChain } from '@cofhe/sdk/chains';
import { cn } from '../../../utils/cn.js';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useCofheChainId, useCofheSupportedChains } from '../../../hooks/useCofheConnection.js';
import { ChainIcon } from './ChainIcon.js';

export const ChainSelect: React.FC = () => {
  const { onChainSwitch, darkMode } = useFnxFloatingButtonContext();
  const chainId = useCofheChainId();
  const supportedChains = useCofheSupportedChains();

  const [open, setOpen] = useState(false);
  const [switchingChain, setSwitchingChain] = useState(false);

  // Get network name from SDK chains
  const chain = chainId ? getChainById(chainId) : undefined;
  const currentNetwork = chain?.name || 'Eth';

  const handleChainSwitch = async (targetChain: CofheChain) => {
    if (targetChain.id === chainId || !onChainSwitch) {
      setOpen(false);
      return;
    }

    setSwitchingChain(true);
    try {
      await onChainSwitch(targetChain.id);
      setOpen(false);
    } catch (error) {
      console.error('Failed to switch chain:', error);
    } finally {
      setSwitchingChain(false);
    }
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded fnx-hover-overlay transition-colors',
          'fnx-text-primary text-sm outline-none border fnx-dropdown-border',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        disabled={switchingChain || supportedChains.length === 0}
      >
        <ChainIcon chainId={chainId} />
        <span className="font-medium">{currentNetwork}</span>
        <KeyboardArrowDownIcon className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'fnx-floating-button fnx-dropdown-bg rounded shadow-lg p-2 border fnx-dropdown-border',
            'z-[10000]',
            darkMode && 'dark'
          )}
          sideOffset={4}
          align="end"
        >
          {supportedChains.length === 0 ? (
            <div className="px-2 py-1 text-sm fnx-text-primary opacity-50">
              No supported chains
            </div>
          ) : (
            supportedChains.map((supportedChain) => {
              const isActive = supportedChain.id === chainId;
              return (
                <DropdownMenu.Item
                  key={supportedChain.id}
                  disabled={switchingChain || isActive}
                  onSelect={() => handleChainSwitch(supportedChain)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded text-sm fnx-text-primary cursor-pointer outline-none text-left',
                    'fnx-dropdown-hover',
                    'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
                    isActive && 'fnx-button-hover-bg'
                  )}
                >
                  <ChainIcon chainId={supportedChain.id} />
                  <span>{supportedChain.name}</span>
                  {isActive && <span className="ml-auto">✓</span>}
                </DropdownMenu.Item>
              );
            })
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
