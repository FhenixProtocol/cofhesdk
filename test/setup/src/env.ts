/** All values inlined at build time by tsup's `define` — see tsup.config.ts */

import { generatePrivateKey } from 'viem/accounts';

export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY as `0x${string}`;

export const TEST_LOCALCOFHE_PRIVATE_KEY = (process.env.TEST_LOCALCOFHE_PRIVATE_KEY ||
  '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659') as `0x${string}`;

export const PRIMARY_TEST_CHAIN = Number(process.env.PRIMARY_TEST_CHAIN || '421614');

/**
 * "Alice", the recipient in the sharing flows on testnets and staging (the Anvil chain has its own,
 * funded Alice). Set TEST_ALICE_PRIVATE_KEY to a funded key of your own and she also sends her own
 * transactions (dismissing a share). Unset, a fresh key is generated once per test process: it holds
 * no gas, so the issuer removes the share instead.
 *
 * Never a public key here. Anvil's default accounts carry EIP-7702 delegations set by strangers on
 * every public testnet, and the ACL then verifies the recipient's signature through that delegate
 * (ERC-1271), which may reject it.
 */
export const TEST_ALICE_KEY_PROVIDED = Boolean(process.env.TEST_ALICE_PRIVATE_KEY);
export const TEST_ALICE_PRIVATE_KEY = (process.env.TEST_ALICE_PRIVATE_KEY || generatePrivateKey()) as `0x${string}`;

/** Same default as setup.mjs's STAGING_CHAIN.rpc — override both together if it moves. */
export const STAGING_RPC_URL = process.env.STAGING_RPC_URL || 'https://staging-hostchain-v1.sw-dom.co';
