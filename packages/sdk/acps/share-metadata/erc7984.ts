import type { Abi } from 'viem';

/**
 * The parts of ERC-7984 (confidential tokens) that share labels most often point at: the balance
 * read and the transfer event. One definition for the SDK's label presets and for apps, with
 * `internalType` kept so `@cofhe/abi` recognises the encrypted values.
 */
export const ERC7984_ABI = [
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'euint64' }],
  },
  {
    type: 'event',
    name: 'ConfidentialTransfer',
    anonymous: false,
    inputs: [
      { name: 'from', type: 'address', indexed: true, internalType: 'address' },
      { name: 'to', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'bytes32', indexed: true, internalType: 'euint64' },
    ],
  },
] as const satisfies Abi;
