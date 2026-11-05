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
import { createTestnetSetup, isTestnetEnabled } from './testnet.js';
import { hardhatChainConfig } from './hardhat.js';
import { stagingChainConfig } from './staging.js';
import type { TestChainConfig } from '../types.js';

const arbSepoliaConfig: TestChainConfig = {
  id: viemArbitrumSepolia.id,
  label: 'Arbitrum Sepolia',
  viemChain: viemArbitrumSepolia,
  cofheChain: cofheArbSepolia,
  rpc: viemArbitrumSepolia.rpcUrls.default.http[0],
  txConfirmationsRequired: 1,
  disabled: !isTestnetEnabled(viemArbitrumSepolia.id),
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
  txConfirmationsRequired: 2,
  disabled: !isTestnetEnabled(viemBaseSepolia.id),
  setup: createTestnetSetup({
    id: viemBaseSepolia.id,
    viemChain: viemBaseSepolia,
    cofheChain: cofheBaseSepolia,
    rpc: viemBaseSepolia.rpcUrls.default.http[0],
  }),
};

// Not viem's default Sepolia RPC. That is thirdweb's public-good endpoint, and it answers the
// suite's bursts of eth_call with 429 even after retries. Of the public endpoints, publicnode
// is the one that takes the load. It is load balanced, so a call can land on a node behind the
// head. The tests that read a value they just wrote read it at the receipt's block for that
// reason, and the ACP status checks ask again when a fresh ACP reads as revoked.
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

const sepoliaConfig: TestChainConfig = {
  id: viemSepolia.id,
  label: 'Ethereum Sepolia',
  viemChain: viemSepolia,
  cofheChain: cofheSepolia,
  rpc: SEPOLIA_RPC,
  txConfirmationsRequired: 1,
  disabled: !isTestnetEnabled(viemSepolia.id),
  setup: createTestnetSetup({
    id: viemSepolia.id,
    viemChain: viemSepolia,
    cofheChain: cofheSepolia,
    rpc: SEPOLIA_RPC,
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
  txConfirmationsRequired: 1,
  disabled: !isTestnetEnabled(viemLocalcofhe.id),
  optIn: true,
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
  stagingChainConfig,
];
