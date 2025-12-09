import { MdOutlineAccountBalanceWallet } from 'react-icons/md';
import { useCofheAccount } from '../../../../hooks/useCofheConnection.js';
import { AddressButton } from '../../components/AddressButton.js';
import { ChainSelect } from '../../components/ChainSelect.js';

export const WalletHeader: React.FC = () => {
  const walletAddress = useCofheAccount();

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Left: Wallet Address */}
      <AddressButton address={walletAddress} icon={<MdOutlineAccountBalanceWallet className="w-4 h-4" />} />

      {/* Right: Network Selector + Settings */}
      <div className="flex items-center gap-2">
        <ChainSelect />
      </div>
    </div>
  );
};
