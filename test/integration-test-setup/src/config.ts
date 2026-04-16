export const TEST_LOCALCOFHE_ENABLED = process.env.TEST_LOCALCOFHE_ENABLED === 'false';

export const TEST_LOCALCOFHE_PRIVATE_KEY = (process.env.TEST_LOCALCOFHE_PRIVATE_KEY ||
  '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659') as `0x${string}`;

export const COFHE_CHAIN_ID = Number(process.env.COFHE_CHAIN_ID || '421614');

/** Chain used for core SDK tests (decrypt, verify, publish). Defaults to Arb Sepolia. */
export const PRIMARY_TEST_CHAIN = Number(process.env.PRIMARY_TEST_CHAIN || '421614');
