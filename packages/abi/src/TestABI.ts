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
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'uint256',
        internalType: 'euint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eUint256',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'euint256',
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
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'tuple',
        internalType: 'struct InEuint8',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEuint16',
        type: 'tuple',
        internalType: 'struct InEuint16',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEuint32',
        type: 'tuple',
        internalType: 'struct InEuint32',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEuint64',
        type: 'tuple',
        internalType: 'struct InEuint64',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEuint128',
        type: 'tuple',
        internalType: 'struct InEuint128',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEuint256',
        type: 'tuple',
        internalType: 'struct InEuint256',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEbool',
        type: 'tuple',
        internalType: 'struct InEbool',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: 'inEaddress',
        type: 'tuple',
        internalType: 'struct InEaddress',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
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
        type: 'tuple[]',
        internalType: 'struct InEuint32[]',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
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
        type: 'tuple',
        internalType: 'struct InEuint32',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
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
        type: 'tuple',
        internalType: 'struct InEuint32',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
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
        type: 'uint256',
        internalType: 'euint8',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'euint16',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'euint32',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'euint64',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'euint128',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'euint256',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'ebool',
      },
      {
        name: '',
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'uint256',
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
        type: 'uint256[]',
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
            type: 'uint256',
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
            type: 'tuple',
            internalType: 'struct InEuint32',
            components: [
              {
                name: 'ctHash',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'securityZone',
                type: 'uint8',
                internalType: 'uint8',
              },
              {
                name: 'utype',
                type: 'uint8',
                internalType: 'uint8',
              },
              {
                name: 'signature',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
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
] as const;
