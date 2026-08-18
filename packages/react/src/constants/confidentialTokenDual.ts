import { parseAbi } from 'viem';

import { CONFIDENTIAL_TOKEN_CLAIM_CONTRACTS } from './confidentialTokenClaims';
import type { ConfidentialTokenContracts } from './tokenTypeConfig';

export const DUAL_TOKEN_CONTRACTS = {
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
            name: 'inValue',
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
  shield: {
    erc20: {
      abi: parseAbi(['function shield(uint256 amount)']),
      functionName: 'shield' as const,
    },
  },
  unshield: {
    abi: parseAbi(['function unshield(uint64 amount) returns (bytes32)']),
    functionName: 'unshield' as const,
  },
  claims: CONFIDENTIAL_TOKEN_CLAIM_CONTRACTS,
} as const satisfies ConfidentialTokenContracts;
