import { useState, useMemo } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { isAddress, maxUint128 } from 'viem';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { useCofheAccount } from '@/hooks/useCofheConnection';
import { useCofheTokenDecryptedBalance } from '@/hooks/useCofheTokenDecryptedBalance';
import { useCofheEncryptInput } from '@/hooks/useCofheEncryptInput';
import { useCofheTokenTransfer, type EncryptedValue } from '@/hooks/useCofheTokenTransfer';
import { cn } from '../../../utils/cn';
import { truncateAddress, sanitizeNumericInput } from '../../../utils/utils';
import { TokenIcon } from '../components/TokenIcon';
import { unitToWei } from '@/utils/format';
import { assert } from 'ts-essentials';
import { CofheTokenConfidentialBalance } from '../components';
import type { Token } from '@/hooks';

export type SendPageProps = {
  token: Token;
};
export const SendPage: React.FC<SendPageProps> = ({ token }) => {
  const { navigateBack, navigateToTokenListForSelection } = useFnxFloatingButtonContext();

  const account = useCofheAccount();
  const tokenTransfer = useCofheTokenTransfer();

  const { data: { unit: confidentialUnitBalance } = {} } = useCofheTokenDecryptedBalance({
    token,
    accountAddress: account,
  });

  // TODO: use useCofheEncrypt instead of useCofheEncryptInput. Delete the latter
  const { onEncryptInput, isEncryptingInput, encryptionProgressLabel } = useCofheEncryptInput();

  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSending = tokenTransfer.isPending;

  // Validate recipient address
  const isValidAddress = useMemo(() => {
    if (!recipientAddress) return false;
    return isAddress(recipientAddress);
  }, [recipientAddress]);

  // Validate amount
  const isValidAmount = useMemo(() => {
    // any of the balances zero or undefined - invalid, can't send
    if (!amount || !confidentialUnitBalance) return false;

    // only valid if balance is enough
    return confidentialUnitBalance.gte(amount);
  }, [amount, confidentialUnitBalance]);

  // TODO: wrap sending into a hook / mutation
  const handleSend = async () => {
    assert(token, 'No token selected for sending');
    if (!isValidAddress) {
      setError('Invalid recipient address');
      return;
    }

    if (!isValidAmount) {
      setError('Invalid amount. Please check your balance.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // Convert amount to token's smallest unit (considering decimals)
      const amountWei = unitToWei(amount, token.decimals);

      // Check if amount exceeds uint128 max value (2^128 - 1)

      // TODO: Does this need to be different if the confidential token uses euint64 for the balance precision?
      assert(amountWei <= maxUint128, 'Amount exceeds maximum supported value (uint128 max)');

      // Encrypt the amount using the token's confidentialValueType
      const confidentialValueType = token.extensions.fhenix.confidentialValueType;
      const encryptedAmount = await onEncryptInput(confidentialValueType, amountWei.toString());

      if (!encryptedAmount || !encryptedAmount.ctHash) {
        throw new Error('Failed to encrypt amount');
      }

      // Construct encrypted value struct
      const encryptedValue: EncryptedValue = {
        ctHash: BigInt(encryptedAmount.ctHash),
        securityZone: encryptedAmount.securityZone ?? 0,
        utype: encryptedAmount.utype ?? 0,
        signature: encryptedAmount.signature as `0x${string}`,
      };

      assert(isAddress(recipientAddress), 'Recipient address is not valid');

      // Use the token transfer hook to send encrypted tokens
      const hash = await tokenTransfer.mutateAsync({
        token,
        to: recipientAddress,
        encryptedValue,
        amount: amountWei,
      });

      setSuccess(`Transaction sent! Hash: ${truncateAddress(hash)}`);
      setAmount('');
      setRecipientAddress('');

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send tokens';
      setError(errorMessage);
      console.error('Send error:', err);
    }
  };

  const handleMaxAmount = () => {
    // Calculate available balance for MAX button
    if (confidentialUnitBalance) setAmount(confidentialUnitBalance.toFixed());
  };

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Back Button */}
      <button
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity mb-2"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">Shielded Transfer</p>
      </button>

      {/* Asset Section */}
      <div className="fnx-card-bg p-2 border fnx-card-border">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium opacity-70">Asset to be sent</label>
        </div>
        <div className="flex items-center gap-3">
          {/* Token Icon */}
          <TokenIcon logoURI={token.logoURI} alt={token.name} size="md" />

          {/* Amount Input and Symbol on same line, centered with logo */}
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(sanitizeNumericInput(e.target.value));
              }}
              placeholder="0.00"
              className="flex-1 min-w-0 bg-transparent text-2xl font-bold fnx-text-primary outline-none placeholder:opacity-50"
            />
            <button
              onClick={() => navigateToTokenListForSelection('Select token to transfer')}
              className="flex items-center gap-1 text-2xl font-bold fnx-text-primary hover:opacity-80 transition-opacity whitespace-nowrap flex-shrink-0"
            >
              <span>{token.symbol}</span>
              <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60 flex-shrink-0" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 -mt-1 text-xs opacity-70">
          {/* Invisible placeholder to align with icon above */}
          <div className="w-10 flex-shrink-0" />

          {/* Available text and MAX button */}
          <div className="flex-1 flex items-center justify-start min-w-0 gap-2">
            <span className="text-xs opacity-70">Available </span>
            <CofheTokenConfidentialBalance
              token={token}
              showSymbol={true}
              size="sm"
              decimalPrecision={5}
              className="text-xs opacity-70 font-medium"
            />
            <button
              onClick={handleMaxAmount}
              className="fnx-max-button text-xxxs ml-1 font-medium px-0.5 py-0.2 rounded"
            >
              MAX
            </button>
          </div>
        </div>
      </div>

      {/* Down Arrow */}
      <div className="flex justify-center">
        <div className="w-8 h-8 rounded-full fnx-icon-bg flex items-center justify-center">
          <span className="text-lg">↓</span>
        </div>
      </div>

      {/* Recipient Address */}
      <div className="fnx-card-bg p-4 border fnx-card-border">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium opacity-70">Recipient Address:</label>
        </div>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="0x..."
          className={cn(
            'w-full bg-transparent fnx-text-primary outline-none border-b pb-2 px-2',
            'placeholder:opacity-50',
            isValidAddress ? 'border-green-500' : recipientAddress ? 'border-red-500' : 'fnx-card-border'
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
        disabled={!isValidAddress || !isValidAmount || isSending || isEncryptingInput}
        className={cn(
          'fnx-send-button w-full py-3 px-4 font-small',
          'flex items-center justify-center gap-2',
          isValidAddress && isValidAmount && !isSending && !isEncryptingInput
            ? 'fnx-send-button-enabled'
            : 'fnx-send-button-disabled'
        )}
      >
        <span>Send</span>
        <span className="text-lg">↗</span>
      </button>
    </div>
  );
};
