import {
  arbitrumSepolia as viemArbitrumSepolia,
  baseSepolia as viemBaseSepolia,
  sepolia as viemSepolia,
} from 'viem/chains';
import { defineChain } from 'viem';
import {
  arbSepolia as cofheArbSepolia,
  baseSepolia as cofheBaseSepolia,
  sepolia as cofheSepolia,
  localcofhe as cofheLocalcofhe,
} from '@cofhe/sdk/chains';
import { TEST_LOCALCOFHE_ENABLED } from '@cofhe/integration-test-setup';
import { createTestnetSetup, isTestnetEnabled } from './testnet.js';
import { hardhatChainConfig } from './hardhat.js';
import type { TestChainConfig } from '../types.js';

const arbSepoliaConfig: TestChainConfig = {
  id: viemArbitrumSepolia.id,
  label: 'Arbitrum Sepolia',
  viemChain: viemArbitrumSepolia,
  cofheChain: cofheArbSepolia,
  rpc: viemArbitrumSepolia.rpcUrls.default.http[0],
  enabled: isTestnetEnabled(viemArbitrumSepolia.id),
  setup: createTestnetSetup({
    id: viemArbitrumSepolia.id,
    viemChain: viemArbitrumSepolia,
    cofheChain: cofheArbSepolia,
    rpc: viemArbitrumSepolia.rpcUrls.default.http[0],
  }),
};

const baseSepoliaConfig: TestChainConfig = {
  id: viemBaseSepolia.id,
  label: 'Base Sepolia',
  viemChain: viemBaseSepolia,
  cofheChain: cofheBaseSepolia,
  rpc: viemBaseSepolia.rpcUrls.default.http[0],
  enabled: isTestnetEnabled(viemBaseSepolia.id),
  setup: createTestnetSetup({
    id: viemBaseSepolia.id,
    viemChain: viemBaseSepolia,
    cofheChain: cofheBaseSepolia,
    rpc: viemBaseSepolia.rpcUrls.default.http[0],
  }),
};

const sepoliaConfig: TestChainConfig = {
  id: viemSepolia.id,
  label: 'Ethereum Sepolia',
  viemChain: viemSepolia,
  cofheChain: cofheSepolia,
  rpc: viemSepolia.rpcUrls.default.http[0],
  enabled: isTestnetEnabled(viemSepolia.id),
  setup: createTestnetSetup({
    id: viemSepolia.id,
    viemChain: viemSepolia,
    cofheChain: cofheSepolia,
    rpc: viemSepolia.rpcUrls.default.http[0],
  }),
};

export const viemLocalcofhe = defineChain({
  id: 420105,
  name: 'Local Cofhe',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:42069'] },
  },
});

const localcofheConfig: TestChainConfig = {
  id: viemLocalcofhe.id,
  label: 'Local CoFHE',
  viemChain: viemLocalcofhe,
  cofheChain: cofheLocalcofhe,
  rpc: viemLocalcofhe.rpcUrls.default.http[0],
  enabled: TEST_LOCALCOFHE_ENABLED && isTestnetEnabled(viemLocalcofhe.id),
  setup: createTestnetSetup({
    id: viemLocalcofhe.id,
    viemChain: viemLocalcofhe,
    cofheChain: cofheLocalcofhe,
    rpc: viemLocalcofhe.rpcUrls.default.http[0],
  }),
};

export const ALL_CHAINS: TestChainConfig[] = [
  hardhatChainConfig,
  localcofheConfig,
  sepoliaConfig,
  arbSepoliaConfig,
  baseSepoliaConfig,
];

const CHAIN_SLUGS: Record<string, string> = {
  hardhat: 'Hardhat (Mock)',
  '31337': 'Hardhat (Mock)',
  localcofhe: 'Local CoFHE',
  '420105': 'Local CoFHE',
  sepolia: 'Ethereum Sepolia',
  '11155111': 'Ethereum Sepolia',
  'arb-sepolia': 'Arbitrum Sepolia',
  'arbitrum-sepolia': 'Arbitrum Sepolia',
  '421614': 'Arbitrum Sepolia',
  'base-sepolia': 'Base Sepolia',
  '84532': 'Base Sepolia',
};

const CHAIN_GROUPS: Record<string, string[]> = {
  testnet: ['sepolia', 'arb-sepolia', 'base-sepolia'],
};

const chainFilterRaw = (process.env.MATRIX_CHAIN || undefined)?.toLowerCase();
const chainFilters = chainFilterRaw
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .flatMap((s) => CHAIN_GROUPS[s] ?? [s]);

if (chainFilters) {
  const invalid = chainFilters.filter((s) => !CHAIN_SLUGS[s]);
  if (invalid.length) {
    throw new Error(
      `Unknown MATRIX_CHAIN value(s): ${invalid.join(', ')}. Valid values: ${Object.keys(CHAIN_SLUGS).join(', ')}, ${Object.keys(CHAIN_GROUPS).join(', ')}`,
    );
  }
}

export const enabledChains = ALL_CHAINS.filter((c) => {
  if (!c.enabled) return false;
  if (!chainFilters) return true;
  return chainFilters.some((slug) => CHAIN_SLUGS[slug] === c.label);
});
