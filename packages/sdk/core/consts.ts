/** Main Task Manager contract address */
export const TASK_MANAGER_ADDRESS = '0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9' as const;

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

/**
 * Recommended gas limits for FHE operations.
 * Standard RPC `eth_estimateGas` underestimates precompile execution costs for homomorphic operations.
 * Integrators can use these gas limits directly when building contract writes with viem / wagmi / ethers.
 */
export const FHE_GAS_LIMITS = {
  /** Gas limit for contract functions performing FHE computation (FHE.asEuint*, FHE.add, FHE.select, FHE.eq, etc.) */
  COMPUTE: 5_000_000n,
  /** Gas limit for contract functions verifying and publishing threshold decryption results (FHE.publishDecryptResult) */
  PUBLISH_RESULT: 500_000n,
  /** Gas limit for contract functions verifying ZK encrypted inputs (verifyInput / TaskManager) */
  VERIFY_INPUT: 1_000_000n,
} as const;

export type FheGasOperationType = keyof typeof FHE_GAS_LIMITS;
