/** All values inlined at build time by tsup's `define` — see tsup.config.ts */

export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY as `0x${string}`;

export const TEST_LOCALCOFHE_PRIVATE_KEY = (process.env.TEST_LOCALCOFHE_PRIVATE_KEY ||
  '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659') as `0x${string}`;

export const PRIMARY_TEST_CHAIN = Number(process.env.PRIMARY_TEST_CHAIN || '421614');

/** Shared "Alice" test account used across chain configs for sharing-permit flows. */
export const TEST_ALICE_PRIVATE_KEY = (process.env.TEST_ALICE_PRIVATE_KEY ||
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`;

/** Same default as setup.mjs's STAGING_CHAIN.rpc — override both together if it moves. */
export const STAGING_RPC_URL = process.env.STAGING_RPC_URL || 'https://staging-hostchain-v1.sw-dom.co';
