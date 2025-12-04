import { useState, useEffect, useRef } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { MdOutlineSettings, MdOutlineAccountBalanceWallet } from 'react-icons/md';
import { getChainById, type CofheChain } from '@cofhe/sdk/chains';
import { cn } from '../../../../utils/cn.js';
import { useFnxFloatingButtonContext, FloatingButtonPage } from '../../FnxFloatingButtonContext.js';
import { useCofheAccount, useCofheChainId, useCofheSupportedChains } from '../../../../hooks/useCofheConnection.js';
import { AddressButton } from '../../components/AddressButton.js';

export const WalletHeader: React.FC = () => {
  const { navigateTo, onSelectChain } = useFnxFloatingButtonContext();
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [switchingChain, setSwitchingChain] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get wallet address and chain ID from CofheProvider
  const walletAddress = useCofheAccount();
  const chainId = useCofheChainId();
  const supportedChains = useCofheSupportedChains();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNetworkDropdown(false);
      }
    };

    if (showNetworkDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNetworkDropdown]);

  // Get network name from SDK chains
  const chain = chainId ? getChainById(chainId) : undefined;
  const currentNetwork = chain?.name || 'Eth';

  const handleChainSwitch = async (targetChain: CofheChain) => {
    if (targetChain.id === chainId || !onSelectChain) {
      setShowNetworkDropdown(false);
      return;
    }

    setSwitchingChain(true);
    try {
      await onSelectChain(targetChain.id);
      setShowNetworkDropdown(false);
    } catch (error) {
      console.error('Failed to switch chain:', error);
    } finally {
      setSwitchingChain(false);
    }
  };

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Left: Wallet Address */}
      <AddressButton address={walletAddress} icon={<MdOutlineAccountBalanceWallet className="w-4 h-4" />} />

      {/* Right: Network Selector + Settings */}
      <div className="flex items-center gap-2">
        {/* Network Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded fnx-hover-overlay transition-colors',
              'fnx-text-primary text-sm'
            )}
          >
            {/* Ethereum logo placeholder - replace with actual logo */}
            <div className="w-4 h-4 rounded-full fnx-icon-bg flex items-center justify-center">
              <span className="text-[8px]">⟠</span>
            </div>
            <span className="font-medium">{currentNetwork}</span>
            <KeyboardArrowDownIcon className="w-4 h-4" />
          </button>

          {/* Dropdown - Show only supported chains */}
          {showNetworkDropdown && (
            <div className="absolute right-0 top-full mt-1 fnx-dropdown-bg rounded shadow-lg p-2 min-w-[140px] z-10 border fnx-dropdown-border">
              {supportedChains.length === 0 ? (
                <div className="px-2 py-1 text-sm fnx-text-primary opacity-50">No supported chains</div>
              ) : (
                supportedChains.map((supportedChain) => {
                  const isActive = supportedChain.id === chainId;
                  return (
                    <button
                      key={supportedChain.id}
                      onClick={() => handleChainSwitch(supportedChain)}
                      disabled={switchingChain || isActive}
                      className={cn(
                        'w-full text-left px-2 py-1 rounded fnx-dropdown-hover text-sm fnx-text-primary',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isActive && 'fnx-button-hover-bg'
                      )}
                    >
                      {supportedChain.name}
                      {isActive && ' ✓'}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Settings Icon */}
        <button
          onClick={() => navigateTo(FloatingButtonPage.Settings)}
          className={cn('p-1 rounded fnx-hover-overlay transition-colors', 'fnx-text-primary')}
        >
          <MdOutlineSettings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
