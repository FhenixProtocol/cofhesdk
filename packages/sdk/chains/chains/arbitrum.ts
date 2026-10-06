import { defineChain } from '../defineChain.js';

/**
 * Arbitrum One mainnet chain configuration
 */
export const arbitrum = defineChain({
  id: 42161,
  name: 'Arbitrum One',
  network: 'arbitrum',
  coFheUrl: 'https://cofhe.mainnet.fhenix.zone',
  verifierUrl: 'https://cofhe-vrf.mainnet.fhenix.zone',
  thresholdNetworkUrl: 'https://cofhe-tn.mainnet.fhenix.zone',
  environment: 'MAINNET',
});
