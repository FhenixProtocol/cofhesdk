import registry from './stagingTestChainRegistry.json';
import { type PrimaryTestChainRegistry } from './primaryTestChain';

/**
 * Values initialized on the CoFHE staging chain (deployments key "420105-staging").
 * Populated by `pnpm test:setup` when TEST_STAGING_ENABLED=true; `{}` until then.
 * Shape-compatible with the primary registry, so `isPrimaryTestChainReady` applies.
 */
export const stagingTestChainRegistry = registry as unknown as PrimaryTestChainRegistry | Record<string, never>;
