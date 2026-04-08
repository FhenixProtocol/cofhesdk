import { useMemo, useState } from 'react';
import { isAddress, type Address } from 'viem';

import { useResolvedCofheToken } from '@/hooks/useResolvedCofheToken';
import { useCustomTokensStore } from '@/stores/customTokensStore';
import type { Token } from '@/types/token';

import type { BalanceType } from '../components/CofheTokenConfidentialBalance';
import { Button } from '../components';

export const ImportCustomTokenCard: React.FC<{
  balanceType: BalanceType;
  tokens: Token[];
  onSelectToken: (token: Token) => void;
}> = ({ tokens, onSelectToken, balanceType }) => {
  const [addressInput, setAddressInput] = useState('');
  const addCustomToken = useCustomTokensStore((state) => state.addCustomToken);

  const trimmedAddress = addressInput.trim();
  const normalizedAddress = isAddress(trimmedAddress) ? (trimmedAddress as Address) : undefined;

  const existingToken = useMemo(() => {
    if (!normalizedAddress) return undefined;
    return tokens.find((token) => token.address.toLowerCase() === normalizedAddress.toLowerCase());
  }, [normalizedAddress, tokens]);

  const resolvedToken = useResolvedCofheToken(
    { address: normalizedAddress },
    {
      enabled: !!normalizedAddress && !existingToken,
      retry: false,
    }
  );

  const previewToken = existingToken ?? resolvedToken.data;
  const canImport = !!previewToken && !resolvedToken.isFetching;

  return (
    <div className="fnx-card-bg border fnx-card-border rounded-lg p-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium opacity-70">Token contract address</label>
        <input
          type="text"
          value={addressInput}
          onChange={(event) => setAddressInput(event.target.value)}
          placeholder="0x..."
          className="w-full bg-transparent fnx-text-primary outline-none border-b pb-2 px-2 text-sm"
        />
      </div>

      {!normalizedAddress && trimmedAddress.length > 0 && (
        <p className="text-xxxs text-[#c2410c]">Enter a valid token address.</p>
      )}

      {resolvedToken.isFetching && !existingToken && (
        <p className="text-xxxs opacity-70">Checking token metadata and CoFHE support...</p>
      )}

      {resolvedToken.error && !existingToken && (
        <p className="text-xxxs text-[#c2410c]">{resolvedToken.error.message}</p>
      )}

      {previewToken && (
        <div className="flex flex-col gap-1 text-xs">
          <p className="font-medium fnx-text-primary">
            {previewToken.symbol} · {previewToken.name}
          </p>
          <p className="opacity-70">
            {previewToken.extensions.fhenix.confidentialityType === 'wrapped'
              ? 'Wrapped confidential token'
              : previewToken.extensions.fhenix.confidentialityType === 'dual'
                ? 'Dual-balance confidential token'
                : 'Pure confidential token'}
          </p>
          {balanceType === 'public' &&
            previewToken.extensions.fhenix.confidentialityType === 'wrapped' &&
            !previewToken.extensions.fhenix.erc20Pair && (
              <p className="text-xxxs opacity-70">
                Public-balance actions may stay unavailable until the token&apos;s paired asset can be discovered.
              </p>
            )}
        </div>
      )}

      <Button
        variant="primary"
        size="sm"
        disabled={!canImport}
        label={existingToken ? 'Select token' : 'Import and select'}
        onClick={() => {
          if (!previewToken) return;
          if (!existingToken) {
            addCustomToken(previewToken);
          }
          onSelectToken(previewToken);
        }}
      />
    </div>
  );
};
