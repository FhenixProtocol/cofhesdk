import { defineChain } from '../defineChain.js';

/**
 * CoFHE staging chain configuration.
 *
 * Hosted staging environment for testing the consuming-contract binding fix
 * (`FhenixProtocol/cofhe-contracts#77` / `zee-k-verifier#37`) against a real verifier
 * service. Shares the same chain ID as `localcofhe` (420105) - it appears to be the same
 * devnet genesis, hosted remotely rather than run locally - but is intentionally kept as
 * a separate entry since its services (verifier, in particular) are on a different,
 * fix-specific deployment.
 */
export const stagingCofhe = defineChain({
  id: 420105,
  name: 'CoFHE Staging',
  network: 'cofhe-staging',
  coFheUrl: 'https://staging-cofhe-v1.sw-dom.co',
  verifierUrl: 'https://zkkkkk-kkkkk-kkkk.sw-dom.co',
  thresholdNetworkUrl: 'https://zolanezzzz.sw-dom.co',
  environment: 'TESTNET',
});
