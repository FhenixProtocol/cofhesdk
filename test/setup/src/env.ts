/** All values inlined at build time by tsup's `define` — see tsup.config.ts */

export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY as `0x${string}`;

export const TEST_LOCALCOFHE_PRIVATE_KEY = (process.env.TEST_LOCALCOFHE_PRIVATE_KEY ||
  '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659') as `0x${string}`;

export const PRIMARY_TEST_CHAIN = Number(process.env.PRIMARY_TEST_CHAIN || '421614');
