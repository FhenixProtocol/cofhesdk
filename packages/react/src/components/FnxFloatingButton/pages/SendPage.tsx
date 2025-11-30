import { useState, useMemo } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useCofheContext } from '../../../providers/CofheProvider.js';
import { useCofheAccount, useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { 
  useTokenConfidentialBalance, 
  useTokenMetadata, 
  usePinnedTokenAddress 
} from '../../../hooks/useTokenBalance.js';
import { useEncryptInput } from '../../../hooks/useEncryptInput.js';
import { useCofheWalletClient } from '../../../hooks/useCofheConnection.js';
import { parseAbi, type Address, isAddress } from 'viem';
import { cn } from '../../../utils/cn.js';
import { truncateAddress } from '../../../utils/utils.js';

const SEND_TOKENS_ABI = parseAbi([
  'function sendTokens(address to, uint256 amount, uint256 nonce) returns (bool)'
]);

export const SendPage: React.FC = () => {
  const { navigateBack, selectedToken, navigateToTokenListForSelection } = useFnxFloatingButtonContext();
  const { client } = useCofheContext();
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const walletClient = useCofheWalletClient();
  
  const pinnedTokenAddress = usePinnedTokenAddress();
  // Use selected token if available, otherwise fall back to pinned token
  const activeTokenAddress = selectedToken && !selectedToken.isNative 
    ? (selectedToken.address as Address)
    : pinnedTokenAddress;
  
  const { data: tokenMetadata } = useTokenMetadata(activeTokenAddress);
  // The hook requires a non-undefined Address, so we provide a fallback
  // The hook's internal enabled check will prevent query execution if the address is invalid
  // We use a sentinel address that will fail the enabled check (but TypeScript needs a valid Address type)
  const tokenAddressForHook: Address = activeTokenAddress || ('0x0000000000000000000000000000000000000000' as Address);
  const { data: confidentialBalance } = useTokenConfidentialBalance(
    { tokenAddress: tokenAddressForHook }
  );
  
  // Use selected token metadata if available, otherwise use fetched metadata
  const displayToken = selectedToken || (tokenMetadata ? {
    name: tokenMetadata.name,
    symbol: tokenMetadata.symbol,
    decimals: tokenMetadata.decimals,
    logoURI: undefined,
  } : null);
  
  const { onEncryptInput, isEncryptingInput, encryptionStep, encryptionProgressLabel } = useEncryptInput();
  
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate available balance in display format
  const availableBalance = useMemo(() => {
    if (!confidentialBalance || !tokenMetadata?.decimals) return '0.00';
    const divisor = BigInt(10 ** tokenMetadata.decimals);
    const normalizedValue = Number(confidentialBalance) / Number(divisor);
    return normalizedValue.toFixed(5).replace(/\.?0+$/, '');
  }, [confidentialBalance, tokenMetadata?.decimals]);

  // Validate recipient address
  const isValidAddress = useMemo(() => {
    if (!recipientAddress) return false;
    return isAddress(recipientAddress);
  }, [recipientAddress]);

  // Validate amount
  const isValidAmount = useMemo(() => {
    if (!amount) return false;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    if (tokenMetadata?.decimals && confidentialBalance) {
      const divisor = BigInt(10 ** tokenMetadata.decimals);
      const maxAmount = Number(confidentialBalance) / Number(divisor);
      return numAmount <= maxAmount;
    }
    return true;
  }, [amount, tokenMetadata?.decimals, confidentialBalance]);

  const handleSend = async () => {
    if (!activeTokenAddress || !tokenMetadata || !walletClient || !account || !client) {
      setError('Missing required data. Please ensure wallet is connected and a token is selected.');
      return;
    }

    if (!isValidAddress) {
      setError('Invalid recipient address');
      return;
    }

    if (!isValidAmount) {
      setError('Invalid amount. Please check your balance.');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert amount to token's smallest unit (considering decimals)
      const amountInSmallestUnit = BigInt(
        Math.floor(parseFloat(amount) * 10 ** tokenMetadata.decimals)
      );

      // Check if amount exceeds uint128 max value (2^128 - 1)
      const UINT128_MAX = BigInt('340282366920938463463374607431768211455'); // 2^128 - 1
      if (amountInSmallestUnit > UINT128_MAX) {
        throw new Error('Amount exceeds maximum supported value (uint128 max)');
      }

      // Encrypt the amount using uint128 type (largest supported FHE type)
      const encryptedAmount = await onEncryptInput('uint128', amountInSmallestUnit.toString());
      
      if (!encryptedAmount || !encryptedAmount.ctHash) {
        throw new Error('Failed to encrypt amount');
      }

      // Extract the ciphertext hash (ctHash) from the encrypted result
      const ctHash = encryptedAmount.ctHash;

      // Call sendTokens with encrypted amount
      // Note: The contract may expect the encrypted value directly or wrapped
      // Adjust based on your contract's actual implementation
      // Using 'as any' to bypass type checking since CofheChain doesn't match viem Chain type
      // The walletClient should handle the chain internally
      const hash = await walletClient.writeContract({
        address: activeTokenAddress,
        abi: SEND_TOKENS_ABI,
        functionName: 'sendTokens',
        args: [recipientAddress as Address, ctHash, 0n],
      } as any);

      setSuccess(`Transaction sent! Hash: ${truncateAddress(hash)}`);
      setAmount('');
      setRecipientAddress('');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send tokens';
      setError(errorMessage);
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleMaxAmount = () => {
    if (availableBalance) {
      setAmount(availableBalance);
    }
  };

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Back Button */}
      <button
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity mb-2"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>

      {/* Asset Section */}
      <div className="fnx-card-bg rounded-lg p-4 border fnx-card-border">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium opacity-70">Asset to be sent</label>
          <button
            onClick={navigateToTokenListForSelection}
            className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
          >
            Change →
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Token Icon */}
          <div className="w-10 h-10 rounded-full fnx-icon-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
            {displayToken?.logoURI ? (
              <img
                src={displayToken.logoURI}
                alt={displayToken.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg">⟠</span>
            )}
          </div>
          
          {/* Amount Input */}
          <div className="flex-1">
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-2xl font-bold fnx-text-primary outline-none placeholder:opacity-50"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs opacity-70">{displayToken?.symbol || tokenMetadata?.symbol || 'TOKEN'}</span>
              <button
                onClick={handleMaxAmount}
                className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs opacity-70">
          Available {availableBalance} {displayToken?.symbol || tokenMetadata?.symbol || ''}
        </div>
      </div>

      {/* Down Arrow */}
      <div className="flex justify-center">
        <div className="w-8 h-8 rounded-full fnx-icon-bg flex items-center justify-center">
          <span className="text-lg">↓</span>
        </div>
      </div>

      {/* Recipient Address */}
      <div className="fnx-card-bg rounded-lg p-4 border fnx-card-border">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium opacity-70">Address:</label>
          <button className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
            saved addresses →
          </button>
        </div>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="0x..."
          className={cn(
            "w-full bg-transparent fnx-text-primary outline-none border-b pb-2",
            "placeholder:opacity-50",
            isValidAddress ? "border-green-500" : recipientAddress ? "border-red-500" : "fnx-card-border"
          )}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Encryption Status */}
      {(isEncryptingInput || isSending) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {isEncryptingInput ? encryptionProgressLabel || 'Encrypting amount...' : 'Sending transaction...'}
          </p>
        </div>
      )}

      {/* Preview Send Button */}
      <button
        onClick={handleSend}
        disabled={!isValidAddress || !isValidAmount || isSending || isEncryptingInput || !activeTokenAddress}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-medium transition-all",
          "flex items-center justify-center gap-2",
          isValidAddress && isValidAmount && !isSending && !isEncryptingInput && pinnedTokenAddress
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
        )}
      >
        <span>Preview Send</span>
        <span className="text-lg">↗</span>
      </button>
    </div>
  );
};
