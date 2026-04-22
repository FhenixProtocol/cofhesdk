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
