export const MockZkVerifierAbi = [
  {
    type: 'function',
    name: 'exists',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'insertCtHash',
    inputs: [
      { name: 'ctHash', type: 'uint256', internalType: 'uint256' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'insertPackedCtHashes',
    inputs: [
      { name: 'ctHashes', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'values', type: 'uint256[]', internalType: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'zkVerify',
    inputs: [
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'utype', type: 'uint8', internalType: 'uint8' },
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct EncryptedInput',
        components: [
          { name: 'ctHash', type: 'uint256', internalType: 'uint256' },
          { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
          { name: 'utype', type: 'uint8', internalType: 'uint8' },
          { name: 'signature', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'zkVerifyCalcCtHash',
    inputs: [
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'utype', type: 'uint8', internalType: 'uint8' },
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'ctHash', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'zkVerifyCalcCtHashesPacked',
    inputs: [
      { name: 'values', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'utypes', type: 'uint8[]', internalType: 'uint8[]' },
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
      { name: 'chainId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'ctHashes', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'zkVerifyPacked',
    inputs: [
      { name: 'values', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'utypes', type: 'uint8[]', internalType: 'uint8[]' },
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
      { name: 'chainId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      {
        name: 'inputs',
        type: 'tuple[]',
        internalType: 'struct EncryptedInput[]',
        components: [
          { name: 'ctHash', type: 'uint256', internalType: 'uint256' },
          { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
          { name: 'utype', type: 'uint8', internalType: 'uint8' },
          { name: 'signature', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'InvalidInputs', inputs: [] },
] as const;
