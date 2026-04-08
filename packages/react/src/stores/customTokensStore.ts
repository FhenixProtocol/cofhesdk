import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Token } from '@/types/token';

type CustomTokensStore = {
  customTokensByChainId: Record<string, Token[]>;
};

type CustomTokensActions = {
  addCustomToken: (token: Token) => void;
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
    }),
    {
      name: 'cofhesdk-react-custom-tokens',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
