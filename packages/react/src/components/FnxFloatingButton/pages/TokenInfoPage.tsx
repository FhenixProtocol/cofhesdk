import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { useCofheTokens } from '../../../hooks/useCofheTokenLists.js';
import { useMemo, useState } from 'react';
import { TokenIcon } from '../components/TokenIcon.js';
import { AddressButton } from '../components/AddressButton.js';
import { TokenBalance } from '../components/TokenBalance.js';
import { useCofheAddToken } from '../../../hooks/useCofheAddToken.js';
import { ActionButton, Card } from '../components/index.js';

export const TokenInfoPage: React.FC = () => {
  const { navigateBack, viewingToken } = useFnxFloatingButtonContext();
  const chainId = useCofheChainId();
  const tokens = useCofheTokens(chainId ?? 0);
  const { addToWallet } = useCofheAddToken();
  const [isAddingToWallet, setIsAddingToWallet] = useState(false);
  const [addToWalletMessage, setAddToWalletMessage] = useState<string | null>(null);

  // Find the full token object from the token list
  const tokenFromList = useMemo(() => {
    if (!viewingToken || !chainId) return null;
    if (viewingToken.isNative) return null;
    return (
      tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === viewingToken.address.toLowerCase()) ||
      null
    );
  }, [viewingToken, chainId, tokens]);

  if (!viewingToken) {
    return (
      <div className="fnx-text-primary space-y-3">
        <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <span>Back</span>
        </button>
        <p className="text-xs opacity-70">Token information not available</p>
      </div>
    );
  }

  const canAddToWallet = !viewingToken.isNative && !!tokenFromList;

  const handleAddToWallet = async () => {
    if (!tokenFromList) return;
    setAddToWalletMessage(null);
    setIsAddingToWallet(true);
    try {
      const ok = await addToWallet(tokenFromList);
      setAddToWalletMessage(ok ? 'Added to wallet' : 'Wallet returned false (token may already be added)');
    } catch (e) {
      setAddToWalletMessage((e as Error)?.message ?? 'Failed to add token to wallet');
    } finally {
      setIsAddingToWallet(false);
    }
  };

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Header */}
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>

      {/* Token Icon and Name */}
      <div className="flex flex-col items-center gap-3">
        <TokenIcon logoURI={viewingToken.logoURI || tokenFromList?.logoURI} alt={viewingToken.name} size="xl" />
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-bold">{viewingToken.name}</h2>
          <p className="text-sm opacity-70">{viewingToken.symbol}</p>
        </div>
      </div>

      {/* Balance Section */}
      <Card className="p-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs opacity-70">Balance</p>
          <TokenBalance
            token={tokenFromList ?? undefined}
            tokenAddress={viewingToken.isNative ? undefined : viewingToken.address}
            isNative={viewingToken.isNative}
            symbol={viewingToken.symbol}
            showSymbol={true}
            size="xl"
            decimalPrecision={5}
            className="font-bold"
          />
        </div>
      </Card>

      {/* Actions */}
      {canAddToWallet && (
        <Card className="p-4 space-y-2">
          <ActionButton
            onClick={handleAddToWallet}
            disabled={isAddingToWallet}
            label={isAddingToWallet ? 'Adding...' : 'Add to wallet'}
          />
          {/* TODO: Use the notification system in the future */}
          {addToWalletMessage && <p className="text-xxs text-red-500 opacity-70 text-center">{addToWalletMessage}</p>}
        </Card>
      )}

      {/* Token Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Token Details</h3>

        {/* Address */}
        {!viewingToken.isNative && (
          <Card>
            <div className="flex flex-col gap-2">
              <p className="text-xxs opacity-70">Contract Address</p>
              <AddressButton address={viewingToken.address} showFullAddress={true} className="w-full justify-start" />
            </div>
          </Card>
        )}

        {/* Decimals */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xxs opacity-70">Decimals</p>
            <p className="text-sm font-medium">{viewingToken.decimals}</p>
          </div>
        </Card>

        {/* Confidentiality Type */}
        {tokenFromList && (
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xxs opacity-70">Confidentiality Type</p>
              <p className="text-sm font-medium capitalize">{tokenFromList.extensions.fhenix.confidentialityType}</p>
            </div>
          </Card>
        )}

        {/* Confidential Value Type */}
        {tokenFromList && (
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xxs opacity-70">Value Type</p>
              <p className="text-sm font-medium">{tokenFromList.extensions.fhenix.confidentialValueType}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
