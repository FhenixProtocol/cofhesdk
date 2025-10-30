export const MockAttesterAddress = '0x0000000000000000000000000000000000000400';

export const MockAttesterAbi = [
  {
    type: 'function',
    name: 'attestEncryptedEncrypted',
    inputs: [
      {
        name: 'lhsHash',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'rhsHash',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'functionId',
        type: 'uint8',
        internalType: 'enum FunctionId',
      },
      {
        name: 'permission',
        type: 'tuple',
        internalType: 'struct Permission',
        components: [
          {
            name: 'issuer',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'expiration',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'validatorId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'validatorContract',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'sealingKey',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'issuerSignature',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'recipientSignature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'success',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'proof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'attestPlaintextEncrypted',
    inputs: [
      {
        name: 'lhsPlaintext',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'rhsHash',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'functionId',
        type: 'uint8',
        internalType: 'enum FunctionId',
      },
      {
        name: 'permission',
        type: 'tuple',
        internalType: 'struct Permission',
        components: [
          {
            name: 'issuer',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'expiration',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'recipient',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'validatorId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'validatorContract',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'sealingKey',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'issuerSignature',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'recipientSignature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'success',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'proof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mockTaskManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract MockTaskManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'validateAttestation',
    inputs: [
      {
        name: 'lhs',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'rhs',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'functionId',
        type: 'uint8',
        internalType: 'enum FunctionId',
      },
      {
        name: 'proof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'isValid',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'AttestationInputNotPermitted',
    inputs: [
      {
        name: 'handle',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidAttestationFunction',
    inputs: [
      {
        name: 'functionId',
        type: 'uint8',
        internalType: 'enum FunctionId',
      },
    ],
  },
] as const;
