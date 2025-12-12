import { MdOutlineAccountBalanceWallet } from 'react-icons/md';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useCofheAccount } from '../../../../hooks/useCofheConnection.js';
import { AddressButton } from '../../components/AddressButton.js';
import { ChainSelect } from '../../components/ChainSelect.js';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';

export const WalletHeader: React.FC = () => {
  const walletAddress = useCofheAccount();
  const { enableBackgroundDecryption, setEnableBackgroundDecryption } = useFnxFloatingButtonContext();

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Left: Wallet Address */}
      <AddressButton address={walletAddress} icon={<MdOutlineAccountBalanceWallet className="w-4 h-4" />} />

      {/* Right: Network Selector + Settings */}
      <div className="flex items-center gap-2">
        <ChainSelect />
        <button
          type="button"
          aria-label={enableBackgroundDecryption ? 'Disable confidentiality' : 'Enable confidentiality'}
          title="Switch confidentiality"
          onClick={() => setEnableBackgroundDecryption(!enableBackgroundDecryption)}
          className="flex items-center gap-1 px-2 py-1 rounded fnx-hover-overlay transition-colors fnx-text-primary text-sm outline-none border fnx-dropdown-border"
        >
          {enableBackgroundDecryption ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
