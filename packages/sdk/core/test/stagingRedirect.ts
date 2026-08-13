import { defineChain } from 'viem';
import { STAGING_RPC } from '@cofhe/test-setup';

declare const __STAGING_TESTS__: boolean | undefined;

/**
 * When TEST_STAGING_ENABLED=true, the sdk tests that exercise live CoFHE
 * backends run against the staging environment instead of their default
 * chain (the primary test chain / hardcoded testnets). Off: unchanged.
 */
export const STAGING_TESTS = typeof __STAGING_TESTS__ !== 'undefined' ? __STAGING_TESTS__ : false;

export const stagingViemChain = defineChain({
  id: 420105,
  name: 'CoFHE Staging',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [STAGING_RPC] } },
});
