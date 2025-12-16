import { useCallback } from 'react';
import { useCofheAccount, useCofheChainId, useCofheWalletClient } from './useCofheConnection.js';
import type { Token } from './useCofheTokenLists.js';
import { useCofheTokenLists } from './useCofheTokenLists.js';
import { useUserTokenStore } from '../stores/userTokenStore';

function assertValidToken(token: Token): void {
  if (!token || typeof token !== 'object') throw new Error('Token is required');
  if (typeof token.chainId !== 'number' || !Number.isFinite(token.chainId))
    throw new Error('token.chainId is required');
  if (!token.address || typeof token.address !== 'string') throw new Error('token.address is required');
  if (!token.symbol || typeof token.symbol !== 'string') throw new Error('token.symbol is required');
  if (typeof token.decimals !== 'number' || !Number.isFinite(token.decimals))
    throw new Error('token.decimals is required');
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
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const tokenLists = useCofheTokenLists({ chainId: chainId ?? 0 });
  const addUserToken = useUserTokenStore((s) => s.addToken);
  const removeUserToken = useUserTokenStore((s) => s.removeToken);
  const hasUserToken = useUserTokenStore((s) => s.hasToken);

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
    async (token: Token) => {
      if (!account) throw new Error('Account is required to add token to list');
      if (!chainId) throw new Error('ChainId is required to add token to list');
      assertValidToken(token);
      if (token.chainId !== chainId) throw new Error('Token chainId must match the currently connected chain');

      // Reject duplicates in user store first
      if (hasUserToken(account, chainId, token.address)) {
        throw new Error('Token already exists in user list');
      }

      // Reject duplicates in any loaded predefined token list(s)
      const normalizedAddr = token.address.toLowerCase();
      for (const result of tokenLists) {
        const list = result.data;
        if (!list) continue;
        const match = list.tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === normalizedAddr);
        if (match) {
          throw new Error('Token already exists in configured token lists');
        }
      }

      addUserToken(account, token);
    },
    [account, chainId, hasUserToken, tokenLists, addUserToken]
  );

  const removeFromList = useCallback(
    async (input: RemoveUserTokenInput) => {
      if (!account) throw new Error('Account is required to remove token from list');
      if (typeof input.chainId !== 'number' || !Number.isFinite(input.chainId)) throw new Error('chainId is required');
      if (!input.address) throw new Error('address is required');

      // throws if not found (per requirement)
      removeUserToken(account, input.chainId, input.address);
    },
    [account, removeUserToken]
  );

  return { addToWallet, addToList, removeFromList };
}
