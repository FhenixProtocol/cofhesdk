declare const __LIVE_TESTNETS__: boolean | undefined;

/**
 * Gates tests that call live testnet CoFHE backends (encrypt via the real
 * zk-verifier, decrypt via the real threshold network). Off by default so
 * the suite stays hermetic; enable with TEST_TESTNETS_ENABLED=true.
 */
export const LIVE_TESTNETS = typeof __LIVE_TESTNETS__ !== 'undefined' ? __LIVE_TESTNETS__ : false;
