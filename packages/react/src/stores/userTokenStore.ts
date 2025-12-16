import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Token } from '../types/token.js';

type TokensByAddress = Record<string, Token>;
type TokensByChain = Record<number, TokensByAddress>;
type TokensByAccount = Record<string, TokensByChain>;

// Safe localStorage access (SSR-safe)
const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(name);
      }
    } catch {
      // localStorage not available
    }
    return null;
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    } catch {
      // localStorage not available
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    } catch {
      // localStorage not available
    }
  },
};

const jsonStorage = createJSONStorage(() => safeLocalStorage);

export interface UserTokenStore {
  tokensByAccount: TokensByAccount;

  addToken: (account: string, token: Token) => void;
  removeToken: (account: string, chainId: number, address: string) => void;
  hasToken: (account: string, chainId: number, address: string) => boolean;
  getTokens: (account: string, chainId: number) => Token[];
}

const normalizeAccount = (account: string) => account.toLowerCase();
const normalizeAddress = (address: string) => address.toLowerCase();
const normalizeAccountAndAddress = (account: string, address: string) => ({
  acct: normalizeAccount(account),
  addr: normalizeAddress(address),
});

export const useUserTokenStore: UseBoundStore<StoreApi<UserTokenStore>> = create<UserTokenStore>()(
  persist(
    (set, get) => ({
      tokensByAccount: {},

      addToken: (account, token) => {
        const { acct, addr } = normalizeAccountAndAddress(account, token.address);
        const chainId = token.chainId;

        set((state) => {
          const byChain: TokensByChain = state.tokensByAccount[acct] || {};
          const byAddress: TokensByAddress = byChain[chainId] || {};

          if (byAddress[addr]) {
            throw new Error('Token already exists in user list');
          }

          return {
            tokensByAccount: {
              ...state.tokensByAccount,
              [acct]: {
                ...byChain,
                [chainId]: {
                  ...byAddress,
                  [addr]: token,
                },
              },
            },
          };
        });
      },

      removeToken: (account, chainId, address) => {
        const { acct, addr } = normalizeAccountAndAddress(account, address);

        set((state) => {
          const byChain = state.tokensByAccount[acct];
          const byAddress = byChain?.[chainId];
          if (!byChain || !byAddress || !byAddress[addr]) {
            throw new Error('Token not found in user list');
          }

          const { [addr]: _removed, ...restByAddress } = byAddress;

          const nextByChain: TokensByChain = { ...byChain };
          if (Object.keys(restByAddress).length === 0) {
            // remove empty chain bucket
            const { [chainId]: _removedChain, ...restChains } = nextByChain;
            const nextTokensByAccount: TokensByAccount = { ...state.tokensByAccount };
            if (Object.keys(restChains).length === 0) {
              // remove empty account bucket
              const { [acct]: _removedAcct, ...restAccounts } = nextTokensByAccount;
              return { tokensByAccount: restAccounts };
            }
            nextTokensByAccount[acct] = restChains;
            return { tokensByAccount: nextTokensByAccount };
          }

          nextByChain[chainId] = restByAddress;
          return {
            tokensByAccount: {
              ...state.tokensByAccount,
              [acct]: nextByChain,
            },
          };
        });
      },

      hasToken: (account, chainId, address) => {
        const { acct, addr } = normalizeAccountAndAddress(account, address);
        return !!get().tokensByAccount[acct]?.[chainId]?.[addr];
      },

      getTokens: (account, chainId) => {
        const { acct } = normalizeAccountAndAddress(account, '');
        const byAddress = get().tokensByAccount[acct]?.[chainId];
        return byAddress ? Object.values(byAddress) : [];
      },
    }),
    {
      name: 'cofhe-user-tokens-v1',
      storage: jsonStorage,
    }
  )
);
