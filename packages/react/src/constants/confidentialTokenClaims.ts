import { parseAbi } from 'viem';

/**
 * Unshield claims, shared by every confidential-token variant.
 *
 * A claim is keyed by 'id' -- a per-claimant, nonce-derived key -- and NOT by the ciphertext
 * handle. 'ctHash' stays on the struct because it is the burned handle that the decryption
 * proof binds to: a caller decrypts 'ctHash' and submits the resulting proof against 'id'.
 *
 * The contract-side shape is declared once in ERC20ConfidentialLib and inherited by the
 * wrapped, wrapped-native and dual tokens alike, so it is declared once here too.
 */
const CLAIM_STRUCT_COMPONENTS = [
  { name: 'id', type: 'bytes32' },
  { name: 'to', type: 'address' },
  { name: 'ctHash', type: 'bytes32' },
  { name: 'decryptedAmount', type: 'uint64' },
  { name: 'claimed', type: 'bool' },
] as const;

export const CONFIDENTIAL_TOKEN_CLAIM_CONTRACTS = {
  single: {
    abi: parseAbi(['function claimUnshielded(bytes32 id, uint64 decryptedAmount, bytes decryptionProof)']),
    functionName: 'claimUnshielded' as const,
  },
  all: {
    abi: parseAbi([
      'function claimUnshieldedBatch(bytes32[] ids, uint64[] decryptedAmounts, bytes[] decryptionProofs)',
    ]),
    functionName: 'claimUnshieldedBatch' as const,
  },
  query: {
    abi: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserClaims',
        outputs: [
          {
            components: CLAIM_STRUCT_COMPONENTS,
            name: 'userClaims',
            type: 'tuple[]',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
    functionName: 'getUserClaims' as const,
  },
} as const;
