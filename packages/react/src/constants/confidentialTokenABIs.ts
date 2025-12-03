import { parseAbi, type Abi } from 'viem';

// ============================================================================
// Confidential Token Balance ABIs
// ============================================================================

/**
 * ABI for wrapped confidentiality type tokens (e.g., Redact)
 * Uses `encBalanceOf(address)` function
 */
export const CONFIDENTIAL_TYPE_WRAPPED_ABI = parseAbi(['function encBalanceOf(address account) view returns (uint256)']);

/**
 * ABI for pure confidentiality type tokens (e.g., Base mini app)
 * Uses `confidentialBalanceOf(address)` function
 */
export const CONFIDENTIAL_TYPE_PURE_ABI = parseAbi(['function confidentialBalanceOf(address account) view returns (uint256)']);

/**
 * ABI for dual confidentiality type tokens (TBD - to be implemented)
 * Uses `TBD_DUAL_FUNCTION_NAME(address)` function
 */
export const CONFIDENTIAL_TYPE_DUAL_ABI = parseAbi(['function TBD_DUAL_FUNCTION_NAME(address account) view returns (uint256)']);

/**
 * Map confidentialityType to balance ABIs and function names
 */
export const CONFIDENTIAL_ABIS = {
  wrapped: {
    abi: CONFIDENTIAL_TYPE_WRAPPED_ABI,
    functionName: 'encBalanceOf' as const,
  },
  pure: {
    abi: CONFIDENTIAL_TYPE_PURE_ABI,
    functionName: 'confidentialBalanceOf' as const,
  },
  dual: {
    // Placeholder for dual type
    abi: CONFIDENTIAL_TYPE_DUAL_ABI,
    functionName: 'TBD_DUAL_FUNCTION_NAME' as const,
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
    name: 'encTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      {
        name: 'inValue',
        type: 'tuple',
        components: [
          { name: 'ctHash', type: 'uint256' },
          { name: 'securityZone', type: 'uint8' },
          { name: 'utype', type: 'uint8' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'transferred', type: 'uint256' }],
  },
] as const satisfies Abi;

/**
 * ABI for pure confidentiality type token transfers
 * Uses `confidentialTransfer(address to, InEuint64 inValue)` function
 */
export const PURE_TRANSFER_ABI = [
  {
    name: 'confidentialTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      {
        name: 'inValue',
        type: 'tuple',
        components: [
          { name: 'ctHash', type: 'uint256' },
          { name: 'securityZone', type: 'uint8' },
          { name: 'utype', type: 'uint8' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'transferred', type: 'uint256' }],
  },
] as const satisfies Abi;

/**
 * ABI for dual confidentiality type token transfers (TBD - to be implemented)
 * Uses `TBD_DUAL_FUNCTION_NAME(address to, InEuintXXX inValue)` function
 */
export const DUAL_TRANSFER_ABI = [
  {
    name: 'TBD_DUAL_FUNCTION_NAME',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      {
        name: 'inValue',
        type: 'tuple',
        components: [
          { name: 'ctHash', type: 'uint256' },
          { name: 'securityZone', type: 'uint8' },
          { name: 'utype', type: 'uint8' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'transferred', type: 'uint256' }],
  },
] as const satisfies Abi;

/**
 * Map confidentialityType to transfer ABIs and function names
 */
export const TRANSFER_ABIS = {
  wrapped: {
    abi: WRAPPED_TRANSFER_ABI,
    functionName: 'encTransfer' as const,
  },
  pure: {
    abi: PURE_TRANSFER_ABI,
    functionName: 'confidentialTransfer' as const,
  },
  dual: {
    // Placeholder for dual type
    abi: DUAL_TRANSFER_ABI,
    functionName: 'TBD_DUAL_FUNCTION_NAME' as const,
  },
} as const;

