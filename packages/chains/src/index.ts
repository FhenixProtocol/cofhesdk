// Export types
export type { CofheChain, Environment } from './types.js';

// Import and export individual chains
import { sepolia } from './chains/sepolia.js';
import { arbSepolia } from './chains/arbSepolia.js';
import { baseSepolia } from './chains/baseSepolia.js';
import { hardhat } from './chains/hardhat.js';

export { sepolia, arbSepolia, baseSepolia, hardhat };

// Export all chains as a collection
export const chains = {
  sepolia,
  arbSepolia,
  baseSepolia,
  hardhat,
} as const;

// Import CofheChain type for helper functions
import type { CofheChain } from './types.js';

// Export chain by ID helper
export const getChainById = (chainId: number): CofheChain | undefined => {
  return Object.values(chains).find((chain) => chain.id === chainId);
};

// Export chain by name helper
export const getChainByName = (name: string): CofheChain | undefined => {
  return Object.values(chains).find(
    (chain) => chain.name.toLowerCase() === name.toLowerCase() || chain.network.toLowerCase() === name.toLowerCase()
  );
};
