import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Token } from '@/types/token';

type CustomTokensStore = {
  customTokensByChainId: Record<string, Token[]>;
};

type CustomTokensActions = {
  addCustomToken: (token: Token) => void;
  removeCustomToken: (params: { chainId: number; address: Token['address'] }) => void;
};

export const useCustomTokensStore = create<CustomTokensStore & CustomTokensActions>()(
  persist(
    (set) => ({
      customTokensByChainId: {},
      addCustomToken: (token) => {
        set((state) => {
          const chainKey = token.chainId.toString();
          const existing = state.customTokensByChainId[chainKey] ?? [];
          const normalizedAddress = token.address.toLowerCase();

          return {
            customTokensByChainId: {
              ...state.customTokensByChainId,
              [chainKey]: [token, ...existing.filter((item) => item.address.toLowerCase() !== normalizedAddress)],
            },
          };
        });
      },
      removeCustomToken: ({ chainId, address }) => {
        set((state) => {
          const chainKey = chainId.toString();
          const existing = state.customTokensByChainId[chainKey] ?? [];
          const filtered = existing.filter((item) => item.address.toLowerCase() !== address.toLowerCase());

          if (filtered.length === existing.length) {
            return state;
          }

          const next = { ...state.customTokensByChainId };
          if (filtered.length === 0) {
            delete next[chainKey];
          } else {
            next[chainKey] = filtered;
          }

          return {
            customTokensByChainId: next,
          };
        });
      },
    }),
    {
      name: 'cofhesdk-react-custom-tokens',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
