import { defineChain } from '../defineChain.js';

/**
 * Base Sepolia testnet chain configuration
 */
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  coFheUrl: 'https://testnet-cofhe.fhenix.zone',
  verifierUrl: 'https://testnet-cofhe-vrf.fhenix.zone',
  thresholdNetworkUrl: 'https://testnet-cofhe-tn.fhenix.zone',
  environment: 'TESTNET',
});
