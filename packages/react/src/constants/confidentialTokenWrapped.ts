import { parseAbi } from 'viem';

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

export const WRAPPED_TOKEN_CONTRACTS = {
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
    ] as const,
    functionName: 'encBalanceOf' as const,
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
    ] as const,
    functionName: 'encTransfer' as const,
  },
  shield: {
    approval: wrappedErc20ApprovalContracts,
    erc20: {
      abi: parseAbi(['function encrypt(address to, uint128 value) public']),
      functionName: 'encrypt' as const,
    },
    native: {
      abi: parseAbi(['function encryptETH(address to) public payable']),
      functionName: 'encryptETH' as const,
    },
    wrappedPair: {
      abi: parseAbi(['function encryptWETH(address to, uint128 value) public']),
      functionName: 'encryptWETH' as const,
    },
  },
  unshield: {
    abi: parseAbi(['function decrypt(address to, uint128 value) public']),
    functionName: 'decrypt' as const,
  },
  claims: {
    single: {
      abi: parseAbi(['function claimDecrypted(uint256 ctHash) public']),
      functionName: 'claimDecrypted' as const,
    },
    all: {
      abi: parseAbi(['function claimAllDecrypted() public']),
      functionName: 'claimAllDecrypted' as const,
    },
    query: {
      abi: [
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
      ] as const,
      functionName: 'getUserClaims' as const,
    },
  },
} as const satisfies TokenConfidentialityContracts;
