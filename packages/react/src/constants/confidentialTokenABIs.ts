import type { Token } from '@/types/token';
import { parseAbi } from 'viem';

// ============================================================================
// ERC20 Standard ABIs (for approval flow)
// ============================================================================

/**
 * ABI for ERC20 allowance check
 */
export const ERC20_ALLOWANCE_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
]);

/**
 * ABI for ERC20 approve
 */
export const ERC20_APPROVE_ABI = parseAbi(['function approve(address spender, uint256 amount) returns (bool)']);

// ============================================================================
// Confidential Token Balance ABIs
// ============================================================================

/**
 * ABI for wrapped confidentiality type tokens (e.g., Redact)
 * Uses `encBalanceOf(address)` function
 */
export const CONFIDENTIAL_TYPE_WRAPPED_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'encBalanceOf',
    outputs: [
      {
        internalType: 'euint128',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Map confidentialityType to balance ABIs and function names
 */
export const CONFIDENTIAL_ABIS = {
  wrapped: {
    abi: CONFIDENTIAL_TYPE_WRAPPED_ABI,
    functionName: 'encBalanceOf' as const,
  },
} as const;

// ============================================================================
// Confidential Token Transfer ABIs
// ============================================================================

/**
 * ABI for wrapped confidentiality type token transfers
 * Uses `encTransfer(address to, InEuint128 inValue)` function
 */
export const WRAPPED_TRANSFER_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'uint256',
            name: 'ctHash',
            type: 'uint256',
          },
          {
            internalType: 'uint8',
            name: 'securityZone',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'utype',
            type: 'uint8',
          },
          {
            internalType: 'bytes',
            name: 'signature',
            type: 'bytes',
          },
        ],
        internalType: 'struct InEuint128',
        name: 'inValue',
        type: 'tuple',
      },
    ],
    name: 'encTransfer',
    outputs: [
      {
        internalType: 'euint128',
        name: 'transferred',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * Map confidentialityType to transfer ABIs and function names
 */
export const TRANSFER_ABIS = {
  wrapped: {
    abi: WRAPPED_TRANSFER_ABI,
    functionName: 'encTransfer' as const,
  },
} as const;

// ============================================================================
// Shield/Unshield ABIs (wrapped tokens)
// ============================================================================

/**
 * ABI for wrapped token encrypt (shield) - requires prior ERC20 approval
 * Transfers ERC20 tokens to wrapper and mints confidential tokens
 */
export const WRAPPED_ENCRYPT_ABI = parseAbi(['function encrypt(address to, uint128 value) public']);

/**
 * ABI for wrapped token decrypt (unshield) - initiates conversion back to ERC20
 * Burns confidential tokens and creates a claim for ERC20
 */
export const WRAPPED_DECRYPT_ABI = parseAbi(['function decrypt(address to, uint128 value) public']);

/**
 * ABI for wrapped token claim decrypted - claims ERC20 after decryption
 */
export const WRAPPED_CLAIM_DECRYPTED_ABI = parseAbi(['function claimDecrypted(uint256 ctHash) public']);

/**
 * ABI for wrapped token claim all decrypted - claims all pending ERC20
 */
export const WRAPPED_CLAIM_ALL_DECRYPTED_ABI = parseAbi(['function claimAllDecrypted() public']);

/**
 * ABI for wrapped token getUserClaims - returns all pending claims for a user
 * Returns array of Claim structs: { ctHash, requestedAmount, decryptedAmount, decrypted, to, claimed }
 */
export const WRAPPED_GET_USER_CLAIMS_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserClaims',
    outputs: [
      {
        components: [
          { name: 'ctHash', type: 'uint256' },
          { name: 'requestedAmount', type: 'uint128' },
          { name: 'decryptedAmount', type: 'uint128' },
          { name: 'decrypted', type: 'bool' },
          { name: 'to', type: 'address' },
          { name: 'claimed', type: 'bool' },
        ],
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * ABI for wrapped ETH encrypt with ETH value
 */
export const WRAPPED_ETH_ENCRYPT_ETH_ABI = parseAbi(['function encryptETH(address to) public payable']);

/**
 * ABI for wrapped ETH encrypt with WETH
 */
export const WRAPPED_ETH_ENCRYPT_WETH_ABI = parseAbi(['function encryptWETH(address to, uint128 value) public']);

/**
 * Map confidentialityType to shield ABIs and function names
 */
export const SHIELD_ABIS = {
  wrapped: {
    abi: WRAPPED_ENCRYPT_ABI,
    functionName: 'encrypt' as const,
  },
} as const;

/**
 * Map confidentialityType to unshield ABIs and function names
 */
export const UNSHIELD_ABIS = {
  wrapped: {
    abi: WRAPPED_DECRYPT_ABI,
    functionName: 'decrypt' as const,
  },
} as const;

/**
 * Map confidentialityType to claim ABIs and function names
 */
export const CLAIM_ABIS = {
  wrapped: {
    abi: WRAPPED_CLAIM_ALL_DECRYPTED_ABI,
    functionName: 'claimAllDecrypted' as const,
  },
} as const;

export function getTokenContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return CONFIDENTIAL_ABIS[confidentialityType];
}
