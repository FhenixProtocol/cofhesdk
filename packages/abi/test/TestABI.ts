export const TestABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eAddress',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'eaddress',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eBool',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'ebool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eNumber',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eUint128',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eUint16',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eUint32',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eUint64',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eUint8',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnAllEncryptedInputs',
    inputs: [
      {
        name: 'inEuint8',
        type: 'bytes32',
        internalType: 'externalEuint8',
      },
      {
        name: 'inEuint16',
        type: 'bytes32',
        internalType: 'externalEuint16',
      },
      {
        name: 'inEuint32',
        type: 'bytes32',
        internalType: 'externalEuint32',
      },
      {
        name: 'inEuint64',
        type: 'bytes32',
        internalType: 'externalEuint64',
      },
      {
        name: 'inEuint128',
        type: 'bytes32',
        internalType: 'externalEuint128',
      },
      {
        name: 'inEbool',
        type: 'bytes32',
        internalType: 'externalEbool',
      },
      {
        name: 'inEaddress',
        type: 'bytes32',
        internalType: 'externalEaddress',
      },
      {
        name: 'inputProof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fnArrayContainsEncryptedInput',
    inputs: [
      {
        name: 'inEuint32Array',
        type: 'bytes32[]',
        internalType: 'externalEuint32[]',
      },
      {
        name: 'inputProof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fnBlendedInputsIncludingEncryptedInput',
    inputs: [
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'inNumber',
        type: 'bytes32',
        internalType: 'externalEuint32',
      },
      {
        name: 'inputProof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fnEncryptedInput',
    inputs: [
      {
        name: 'inNumber',
        type: 'bytes32',
        internalType: 'externalEuint32',
      },
      {
        name: 'inputProof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fnNoEncryptedInputs',
    inputs: [
      {
        name: 'value',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fnReturnAllEncrypted',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint8',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint16',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint32',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint64',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint128',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'ebool',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'eaddress',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnReturnBlendedIncludingEncrypted',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnReturnEncrypted',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'euint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnReturnEncryptedArray',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32[]',
        internalType: 'euint32[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnReturnEncryptedStruct',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ABITest.ContainsEncryptedResult',
        components: [
          {
            name: 'value',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'encryptedResult',
            type: 'bytes32',
            internalType: 'euint32',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnReturnNoEncrypted',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'fnStructContainsEncryptedInput',
    inputs: [
      {
        name: 'containsEncryptedInput',
        type: 'tuple',
        internalType: 'struct ABITest.ContainsEncryptedInput',
        components: [
          {
            name: 'value',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'encryptedInput',
            type: 'bytes32',
            internalType: 'externalEuint32',
          },
        ],
      },
      {
        name: 'inputProof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fnTupleContainsEncryptedInput',
    inputs: [
      {
        name: 'inEuint32Array',
        type: 'bytes32[2]',
        internalType: 'externalEuint32[2]',
      },
      {
        name: 'inputProof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'numberHash',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AllEncrypted',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint8',
      },
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint16',
      },
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint32',
      },
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint64',
      },
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint128',
      },
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'ebool',
      },
      {
        name: '',
        type: 'bytes32',
        indexed: false,
        internalType: 'eaddress',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BlendedValue',
    inputs: [
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'encryptedValue',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EncryptedArray',
    inputs: [
      {
        name: 'value',
        type: 'bytes32[]',
        indexed: false,
        internalType: 'euint32[]',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EncryptedStruct',
    inputs: [
      {
        name: 'value',
        type: 'tuple',
        indexed: false,
        internalType: 'struct ABITest.ContainsEncryptedResult',
        components: [
          {
            name: 'value',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'encryptedResult',
            type: 'bytes32',
            internalType: 'euint32',
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EncryptedValue',
    inputs: [
      {
        name: 'value',
        type: 'bytes32',
        indexed: false,
        internalType: 'euint32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EventNoEncryptedInputs',
    inputs: [
      {
        name: 'value',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'SecurityZoneOutOfBounds',
    inputs: [
      {
        name: 'value',
        type: 'int32',
        internalType: 'int32',
      },
    ],
  },
  // ERC-7984 `*AndCall`: the proof pairs with the handle, and the call payload follows it.
  {
    type: 'function',
    name: 'fnProofNotLast',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'encryptedAmount', type: 'bytes32', internalType: 'externalEuint64' },
      { name: 'inputProof', type: 'bytes', internalType: 'bytes' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Two named handles sharing one signature, with a trailing non-encrypted arg.
  {
    type: 'function',
    name: 'fnTwoHashesProofThenExtra',
    inputs: [
      { name: 'amount', type: 'bytes32', internalType: 'externalEuint32' },
      { name: 'fee', type: 'bytes32', internalType: 'externalEuint32' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
      { name: 'memo', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Invalid: encrypted inputs separated by a non-encrypted parameter.
  {
    type: 'function',
    name: 'fnNonContiguousExternals',
    inputs: [
      { name: 'a', type: 'bytes32', internalType: 'externalEuint32' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'b', type: 'bytes32', internalType: 'externalEuint32' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Invalid: nothing follows the encrypted input.
  {
    type: 'function',
    name: 'fnMissingProofSlot',
    inputs: [{ name: 'amount', type: 'bytes32', internalType: 'externalEuint32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
