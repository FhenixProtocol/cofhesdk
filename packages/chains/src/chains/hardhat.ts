import { defineChain } from '../defineChain.js';

/**
 * Hardhat local development chain configuration
 */
export const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat',
  network: 'localhost',
  // These are unused in the mock environment
  coFheUrl: 'http://127.0.0.1:8448',
  verifierUrl: 'http://127.0.0.1:3001',
  thresholdNetworkUrl: 'http://127.0.0.1:3000',
  environment: 'MOCK',
});
