import { parseAbi, zeroAddress } from 'viem';

import type { TokenConfidentialityContracts } from './confidentialTokenABIs';

const wrappedErc20ApprovalContracts = {
  allowance: {
    abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
    functionName: 'allowance' as const,
  },
  approve: {
    abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
    functionName: 'approve' as const,
  },
} as const;

const SHARED_WRAPPED_TOKEN_CONTRACTS = {
  detection: {
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
    args: [zeroAddress],
  },
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
            internalType: 'struct InEuint64',
            name: 'encryptedAmount',
            type: 'tuple',
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
  claims: {
    single: {
      abi: parseAbi([
        'function getClaim(bytes32 ctHash) view returns ((address to, bytes32 ctHash, uint64 requestedAmount, uint64 decryptedAmount, bool claimed))',
      ]),
      functionName: 'getClaim' as const,
    },
    all: {
      abi: parseAbi([
        'function claimUnshieldedBatch(bytes32[] ctHashes, uint64[] decryptedAmounts, bytes[] decryptionProofs)',
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
              components: [
                { name: 'to', type: 'address' },
                { name: 'ctHash', type: 'bytes32' },
                { name: 'requestedAmount', type: 'uint64' },
                { name: 'decryptedAmount', type: 'uint64' },
                { name: 'claimed', type: 'bool' },
              ],
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
  },
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
} as const satisfies TokenConfidentialityContracts;

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
} as const satisfies TokenConfidentialityContracts;
