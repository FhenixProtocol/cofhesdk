import { useMemo, useState } from 'react';
import { isAddress, type Address } from 'viem';

import { useCofheChainId } from '@/hooks/useCofheConnection';
import { useResolvedCofheToken } from '@/hooks/useResolvedCofheToken';
import { useCustomTokensStore } from '@/stores/customTokensStore';
import { getTokenConfidentialityLabel, type Token } from '@/types/token';

import type { BalanceType } from '../components/CofheTokenConfidentialBalance';
import { Button } from '../components';

export const ImportCustomTokenCard: React.FC<{
  balanceType: BalanceType;
  tokens: Token[];
  onSelectToken: (token: Token) => void;
}> = ({ tokens, onSelectToken, balanceType }) => {
  const [addressInput, setAddressInput] = useState('');
  const chainId = useCofheChainId();
  const addCustomToken = useCustomTokensStore((state) => state.addCustomToken);
  const removeCustomToken = useCustomTokensStore((state) => state.removeCustomToken);
  const customTokensByChainId = useCustomTokensStore((state) => state.customTokensByChainId);

  const trimmedAddress = addressInput.trim();
  const normalizedAddress = isAddress(trimmedAddress) ? (trimmedAddress as Address) : undefined;

  const importedCustomTokens = useMemo(() => {
    if (!chainId) return [];
    return customTokensByChainId[chainId.toString()] ?? [];
  }, [chainId, customTokensByChainId]);

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
            {getTokenConfidentialityLabel(previewToken.extensions.fhenix.confidentialityType) ?? 'Confidential token'}
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

      {importedCustomTokens.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs font-medium opacity-70">Imported tokens</p>
          {importedCustomTokens.map((token) => (
            <div
              key={`${token.chainId}-${token.address}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium fnx-text-primary truncate">
                  {token.symbol} · {token.name}
                </p>
                <p className="text-xxxs opacity-70 truncate">{token.address}</p>
              </div>
              <Button
                variant="error"
                size="sm"
                label="Remove"
                onClick={() => {
                  removeCustomToken({
                    chainId: token.chainId,
                    address: token.address,
                  });

                  if (normalizedAddress?.toLowerCase() === token.address.toLowerCase()) {
                    setAddressInput('');
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
