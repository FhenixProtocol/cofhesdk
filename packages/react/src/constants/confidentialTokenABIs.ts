import type { Token, TokenConfidentialityType } from '@/types/token';
import { parseAbi } from 'viem';

type ContractConfig = {
  abi: readonly unknown[];
  functionName: string;
};

function getRequiredContractConfig<TConfig>(
  configs: Partial<Record<TokenConfidentialityType, TConfig>>,
  confidentialityType: TokenConfidentialityType,
  operation: string
): TConfig {
  const config = configs[confidentialityType];
  if (!config) {
    throw new Error(`${operation} config is not defined for confidentialityType: ${confidentialityType}`);
  }
  return config;
}

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
const CONFIDENTIAL_TYPE_WRAPPED_ABI = [
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
const CONFIDENTIAL_ABIS = {
  wrapped: {
    abi: CONFIDENTIAL_TYPE_WRAPPED_ABI,
    functionName: 'encBalanceOf' as const,
  },
} as const satisfies Partial<Record<TokenConfidentialityType, ContractConfig>>;

// ============================================================================
// Confidential Token Transfer ABIs
// ============================================================================

/**
 * ABI for wrapped confidentiality type token transfers
 * Uses `encTransfer(address to, InEuint128 inValue)` function
 */
const WRAPPED_TRANSFER_ABI = [
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
const TRANSFER_ABIS = {
  wrapped: {
    abi: WRAPPED_TRANSFER_ABI,
    functionName: 'encTransfer' as const,
  },
} as const satisfies Partial<Record<TokenConfidentialityType, ContractConfig>>;

// ============================================================================
// Shield/Unshield ABIs (wrapped tokens)
// ============================================================================

/**
 * ABI for wrapped token encrypt (shield) - requires prior ERC20 approval
 * Transfers ERC20 tokens to wrapper and mints confidential tokens
 */
const WRAPPED_ENCRYPT_ABI = parseAbi(['function encrypt(address to, uint128 value) public']);

/**
 * ABI for wrapped token decrypt (unshield) - initiates conversion back to ERC20
 * Burns confidential tokens and creates a claim for ERC20
 */
const WRAPPED_DECRYPT_ABI = parseAbi(['function decrypt(address to, uint128 value) public']);

/**
 * ABI for wrapped token claim decrypted - claims ERC20 after decryption
 */
const WRAPPED_CLAIM_DECRYPTED_ABI = parseAbi(['function claimDecrypted(uint256 ctHash) public']);

/**
 * ABI for wrapped token claim all decrypted - claims all pending ERC20
 */
const WRAPPED_CLAIM_ALL_DECRYPTED_ABI = parseAbi(['function claimAllDecrypted() public']);

/**
 * ABI for wrapped token getUserClaims - returns all pending claims for a user
 * Returns array of Claim structs: { ctHash, requestedAmount, decryptedAmount, decrypted, to, claimed }
 */
const WRAPPED_GET_USER_CLAIMS_ABI = [
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
const WRAPPED_ETH_ENCRYPT_ETH_ABI = parseAbi(['function encryptETH(address to) public payable']);

/**
 * ABI for wrapped ETH encrypt with WETH
 */
const WRAPPED_ETH_ENCRYPT_WETH_ABI = parseAbi(['function encryptWETH(address to, uint128 value) public']);

/**
 * Map confidentialityType to shield ABIs and function names
 */
const SHIELD_ABIS = {
  wrapped: {
    abi: WRAPPED_ENCRYPT_ABI,
    functionName: 'encrypt' as const,
  },
} as const satisfies Partial<Record<TokenConfidentialityType, ContractConfig>>;

const SHIELD_ETH_ABIS = {
  wrapped: {
    abi: WRAPPED_ETH_ENCRYPT_ETH_ABI,
    functionName: 'encryptETH' as const,
  },
} as const satisfies Partial<Record<TokenConfidentialityType, ContractConfig>>;

/**
 * Map confidentialityType to unshield ABIs and function names
 */
const UNSHIELD_ABIS = {
  wrapped: {
    abi: WRAPPED_DECRYPT_ABI,
    functionName: 'decrypt' as const,
  },
} as const satisfies Partial<Record<TokenConfidentialityType, ContractConfig>>;

/**
 * Map confidentialityType to claim ABIs and function names
 */
const CLAIM_ABIS = {
  wrapped: {
    abi: WRAPPED_CLAIM_ALL_DECRYPTED_ABI,
    functionName: 'claimAllDecrypted' as const,
  },
} as const satisfies Partial<Record<TokenConfidentialityType, ContractConfig>>;

export function getTokenContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(CONFIDENTIAL_ABIS, confidentialityType, 'confidential balance');
}

export function getTransferContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(TRANSFER_ABIS, confidentialityType, 'transfer');
}

export function getShieldContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(SHIELD_ABIS, confidentialityType, 'shield');
}

export function getShieldEthContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(SHIELD_ETH_ABIS, confidentialityType, 'shield ETH');
}

export function getUnshieldContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(UNSHIELD_ABIS, confidentialityType, 'unshield');
}

export function getClaimContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return getRequiredContractConfig(CLAIM_ABIS, confidentialityType, 'claim');
}

export function getClaimableContractConfig(confidentialityType: Token['extensions']['fhenix']['confidentialityType']) {
  return {
    ...getRequiredContractConfig(CLAIM_ABIS, confidentialityType, 'claimable'),
    abi: WRAPPED_GET_USER_CLAIMS_ABI,
    functionName: 'getUserClaims' as const,
  };
}
