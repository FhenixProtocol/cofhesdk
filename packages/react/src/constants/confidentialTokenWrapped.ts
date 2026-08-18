import { parseAbi } from 'viem';

import { CONFIDENTIAL_TOKEN_CLAIM_CONTRACTS } from './confidentialTokenClaims';
import { ERC20_ALLOWANCE_ABI, ERC20_APPROVE_ABI } from './erc20ABIs';
import type { ConfidentialTokenContracts } from './tokenTypeConfig';

const wrappedErc20ApprovalContracts = {
  allowance: {
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'allowance' as const,
  },
  approve: {
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve' as const,
  },
} as const;

const SHARED_WRAPPED_TOKEN_CONTRACTS = {
  confidentialBalance: {
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'account',
            type: 'address',
          },
        ],
        name: 'confidentialBalanceOf',
        outputs: [
          {
            internalType: 'euint64',
            name: '',
            type: 'bytes32',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
    functionName: 'confidentialBalanceOf' as const,
  },
  confidentialTransfer: {
    abi: [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'externalEuint64',
            name: 'encryptedAmount',
            type: 'bytes32',
          },
          {
            internalType: 'bytes',
            name: 'inputProof',
            type: 'bytes',
          },
        ],
        name: 'confidentialTransfer',
        outputs: [
          {
            internalType: 'euint64',
            name: 'transferred',
            type: 'bytes32',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ] as const,
    functionName: 'confidentialTransfer' as const,
  },
  unshield: {
    abi: parseAbi(['function unshield(address from, address to, uint64 amount) returns (bytes32)']),
    functionName: 'unshield' as const,
  },
  claims: CONFIDENTIAL_TOKEN_CLAIM_CONTRACTS,
} as const;

export const WRAPPED_TOKEN_CONTRACTS = {
  ...SHARED_WRAPPED_TOKEN_CONTRACTS,
  shield: {
    approval: wrappedErc20ApprovalContracts,
    erc20: {
      abi: parseAbi(['function shield(address to, uint256 amount) returns (bytes32)']),
      functionName: 'shield' as const,
    },
    wrappedPair: {
      abi: parseAbi(['function shield(address to, uint256 amount) returns (bytes32)']),
      functionName: 'shield' as const,
    },
  },
} as const satisfies ConfidentialTokenContracts;

export const WRAPPED_NATIVE_TOKEN_CONTRACTS = {
  ...SHARED_WRAPPED_TOKEN_CONTRACTS,
  shield: {
    approval: wrappedErc20ApprovalContracts,
    erc20: {
      abi: parseAbi(['function shieldWrappedNative(address to, uint256 value) returns (bytes32)']),
      functionName: 'shieldWrappedNative' as const,
    },
    native: {
      abi: parseAbi(['function shieldNative(address to) payable returns (bytes32)']),
      functionName: 'shieldNative' as const,
    },
    wrappedPair: {
      abi: parseAbi(['function shieldWrappedNative(address to, uint256 value) returns (bytes32)']),
      functionName: 'shieldWrappedNative' as const,
    },
  },
} as const satisfies ConfidentialTokenContracts;
