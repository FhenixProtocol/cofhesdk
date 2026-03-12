import { defineChain } from '../defineChain.js';

/**
 * Linea Sepolia testnet chain configuration
 */
export const lineaSepolia = defineChain({
  id: 59141,
  name: 'Linea Sepolia',
  network: 'linea-sepolia',
  thresholdNetworkUrl: 'https://dispatcher.linea.sw-dom.co',
  coFheUrl: 'https://cofhe.linea.sw-dom.co',
  verifierUrl: 'https://zk-verifier.linea.sw-dom.co',
  environment: 'TESTNET',
});
