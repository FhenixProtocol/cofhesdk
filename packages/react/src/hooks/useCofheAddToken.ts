import { useCallback } from 'react';
import { useCofheWalletClient } from './useCofheConnection.js';
import type { Token } from './useCofheTokenLists.js';

function assertValidToken(token: Token): void {
  if (!token || typeof token !== 'object') throw new Error('Token is required');
  if (typeof token.chainId !== 'number' || !Number.isFinite(token.chainId)) throw new Error('token.chainId is required');
  if (!token.address || typeof token.address !== 'string') throw new Error('token.address is required');
  if (!token.symbol || typeof token.symbol !== 'string') throw new Error('token.symbol is required');
  if (typeof token.decimals !== 'number' || !Number.isFinite(token.decimals)) throw new Error('token.decimals is required');
  if (!token.name || typeof token.name !== 'string') throw new Error('token.name is required');

  const fhenix = token.extensions?.fhenix;
  if (!fhenix) throw new Error('token.extensions.fhenix is required');
  if (!fhenix.confidentialityType) throw new Error('token.extensions.fhenix.confidentialityType is required');
  if (!fhenix.confidentialValueType) throw new Error('token.extensions.fhenix.confidentialValueType is required');
}

export type RemoveUserTokenInput = { chainId: number; address: string };

export type UseCofheAddTokenResult = {
  addToWallet: (token: Token) => Promise<boolean>;
  addToList: (token: Token) => Promise<void>;
  removeFromList: (input: RemoveUserTokenInput) => Promise<void>;
};

export function useCofheAddToken(): UseCofheAddTokenResult {
  const walletClient = useCofheWalletClient();

  const addToWallet = useCallback(
    async (token: Token) => {
      if (!walletClient) throw new Error('WalletClient is required to add token to wallet');
      assertValidToken(token);

      const params = {
        type: 'ERC20',
        options: {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          image: token.logoURI,
        },
      };

      const request = (walletClient as any).request ?? (walletClient as any).transport?.request;
      if (!request) throw new Error('WalletClient does not support JSON-RPC requests');

      const result = await request({
        method: 'wallet_watchAsset',
        params,
      });

      // `wallet_watchAsset` return values are not consistent across wallets/versions.
      // Treat explicit `false` as a rejection; anything else is considered success.
      return result !== false;
    },
    [walletClient]
  );

  const addToList = useCallback(
    async (_token: Token) => {
      /**
       * TODO (token persistence):
       * - Choose storage key format for user tokens (v1)
       * - Load predefined list for chainId and reject duplicates (ignore + throw)
       * - Persist full `Token` objects into iframe shared storage (`config.fheKeyStorage`)
       * - Invalidate react-query key used by `useCofheTokens`
       * - Add `removeFromList` support
       */
      throw new Error('addToList is not implemented yet');
    },
    []
  );

  const removeFromList = useCallback(
    async (_input: RemoveUserTokenInput) => {
      /**
       * TODO (token persistence):
       * - Remove only user-added tokens (by chainId + address) from shared storage
       * - If token not found, either no-op or throw (decide behavior)
       * - Invalidate react-query key used by `useCofheTokens`
       */
      throw new Error('removeFromList is not implemented yet');
    },
    []
  );

  return { addToWallet, addToList, removeFromList };
}


