import { defineChain } from '../defineChain.js';

/**
 * Localcofhe chain configuration
 */
export const localcofhe = defineChain({
  id: 420105,
  name: 'Local Cofhe',
  network: 'localhost',
  coFheUrl: 'http://127.0.0.1:9448',
  verifierUrl: 'http://127.0.0.1:3001',
  thresholdNetworkUrl: 'http://127.0.0.1:3000',
  environment: 'TESTNET',
});
