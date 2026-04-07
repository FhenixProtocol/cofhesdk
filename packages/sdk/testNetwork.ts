import { arbSepolia, localcofhe, type CofheChain } from '@/chains';

import type { Chain } from 'viem';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';

const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const viteEnv = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>;
const env = { ...viteEnv, ...processEnv };

export const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const parseChainIdEnv = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const asNumber = Number(trimmed);
  return Number.isInteger(asNumber) && asNumber > 0 ? asNumber : undefined;
};

const localcofheHostChainRpc =
  env.LOCALCOFHE_HOST_CHAIN_RPC || env.VITE_LOCALCOFHE_HOST_CHAIN_RPC || 'http://127.0.0.1:42069';

const viemLocalcofheChain: Chain = {
  id: localcofhe.id,
  name: localcofhe.name,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [localcofheHostChainRpc],
    },
  },
};

type SelectedTestNetwork = {
  sdkChain: CofheChain;
  viemChain: Chain;
  rpcUrl: string;
  privateKey: `0x${string}`;
  isLocalcofhe: boolean;
};

const requestedChainId = parseChainIdEnv(
  env.COFHE_CHAIN_ID ?? env.TEST_CHAIN_ID ?? env.VITE_COFHE_CHAIN_ID ?? env.VITE_TEST_CHAIN_ID
);

export const selectedTestNetwork: SelectedTestNetwork =
  requestedChainId === localcofhe.id
    ? {
        sdkChain: localcofhe,
        viemChain: viemLocalcofheChain,
        rpcUrl: localcofheHostChainRpc,
        privateKey: (env.LOCALCOFHE_PRIVATE_KEY ||
          env.VITE_LOCALCOFHE_PRIVATE_KEY ||
          env.TEST_PRIVATE_KEY ||
          env.VITE_TEST_PRIVATE_KEY ||
          DEFAULT_TEST_PRIVATE_KEY) as `0x${string}`,
        isLocalcofhe: true,
      }
    : {
        sdkChain: arbSepolia,
        viemChain: viemArbitrumSepolia,
        rpcUrl:
          env.ARBITRUM_SEPOLIA_RPC_URL || env.VITE_ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        privateKey: (env.TEST_PRIVATE_KEY || env.VITE_TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY) as `0x${string}`,
        isLocalcofhe: false,
      };
