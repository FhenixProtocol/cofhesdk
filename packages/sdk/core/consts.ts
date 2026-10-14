/**
 * CoFHEAddressBook contract address - the same on every chain. Resolves `TASK_MANAGER_ID` to the
 * chain's Task Manager. Keep in sync with `COFHE_ADDRESS_BOOK` in `@fhenixprotocol/cofhe-contracts/FHE.sol`.
 */
export const COFHE_ADDRESS_BOOK_ADDRESS = '0xC0F4e00E531a2B086492Ae3DCC1515038307196b' as const;

/** Id of the Task Manager in the CoFHEAddressBook. Keep in sync with `TASK_MANAGER_ID` in FHE.sol */
export const TASK_MANAGER_ID = 1n;

/**
 * Mock Task Manager contract address (used for testing). Registered in the mock CoFHEAddressBook;
 * SDK reads still resolve the Task Manager through the book.
 */
export const MOCKS_TASK_MANAGER_ADDRESS = '0x0000000000000000000000000000000000005000' as const;

/** Mock ZK Verifier contract address (used for testing) */
export const MOCKS_ZK_VERIFIER_ADDRESS = '0x0000000000000000000000000000000000005001' as const;

/** Mock Threshold Network contract address (used for testing) */
export const MOCKS_THRESHOLD_NETWORK_ADDRESS = '0x0000000000000000000000000000000000005002' as const;

/** Private key for the Mock ZK Verifier signer account */
export const MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY =
  '0x6C8D7F768A6BB4AAFE85E8A2F5A9680355239C7E14646ED62B044E39DE154512' as const;

/** Address for the Mock ZK Verifier signer account */
export const MOCKS_ZK_VERIFIER_SIGNER_ADDRESS = '0x6E12D8C87503D4287c294f2Fdef96ACd9DFf6bd2' as const;

/** Private key for the Mock decrypt result signer account */
export const MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

/** Maximum total bits for ZK proof packing */
export const TFHE_RS_ZK_MAX_BITS = 2048 as const;

/** Size limit for safe_serialize/safe_deserialize (1 GB) */
export const TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT = BigInt(1 << 30);

/** TFHE.rs key version (invalidates cached keys) */
export const TFHE_RS_KEY_VERSION = 2;
