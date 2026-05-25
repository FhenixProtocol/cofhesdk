import { parseAbi, zeroAddress } from 'viem';

import type { TokenConfidentialityContracts } from './confidentialTokenABIs';

export const DUAL_TOKEN_CONTRACTS = {
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
                        name: 'inValue',
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
} as const satisfies TokenConfidentialityContracts;