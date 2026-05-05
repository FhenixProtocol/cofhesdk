import { defineChain } from '../defineChain.js';

/**
 * Hardhat local development chain configuration
 */
export const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat',
  network: 'localhost',
  // These are unused in the mock environment
  coFheUrl: 'http://ignored-in-mock-environment',
  verifierUrl: 'http://ignored-in-mock-environment',
  thresholdNetworkUrl: 'http://ignored-in-mock-environment',
  environment: 'MOCK',
});
