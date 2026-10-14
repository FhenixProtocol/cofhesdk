import { defineChain } from '../defineChain.js';

/**
 * Ethereum mainnet chain configuration
 */
export const ethereum = defineChain({
  id: 1,
  name: 'Ethereum',
  network: 'ethereum',
  coFheUrl: 'https://cofhe.mainnet.fhenix.zone',
  verifierUrl: 'https://cofhe-vrf.mainnet.fhenix.zone',
  thresholdNetworkUrl: 'https://cofhe-tn.mainnet.fhenix.zone',
  environment: 'MAINNET',
});
