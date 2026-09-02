import { transformEncryptedReturnTypes } from 'src/encryptedReturnTypes';
import { describe, it, expect } from 'vitest';
import { TestABI } from './TestABI';
import { FheTypes } from '@cofhe/sdk';

describe('transformEncryptedReturnTypes', () => {
  it('should not transform non-encrypted return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnNoEncrypted', 1n);
    expect(result).toEqual(1n);
  });
  it('should transform single encrypted return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncrypted', '0x1');
    expect(result).toEqual({
      ctHash: '0x1',
      utype: FheTypes.Uint32,
    });
  });
  it('should transform blended return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnBlendedIncludingEncrypted', [1n, '0x2']);
    expect(result).toEqual([
      1n,
      {
        ctHash: '0x2',
        utype: FheTypes.Uint32,
      },
    ]);
  });
  it('should transform encrypted array return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncryptedArray', ['0x1', '0x2']);
    expect(result).toEqual([
      {
        ctHash: '0x1',
        utype: FheTypes.Uint32,
      },
      {
        ctHash: '0x2',
        utype: FheTypes.Uint32,
      },
    ]);
  });
  it('should transform encrypted struct return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncryptedStruct', {
      value: 1n,
      encryptedResult: '0x2',
    });
    expect(result).toEqual({
      value: 1n,
      encryptedResult: {
        ctHash: '0x2',
        utype: FheTypes.Uint32,
      },
    });
  });
  it('should transform all encrypted return types', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnAllEncrypted', [
      '0x1',
      '0x2',
      '0x3',
      '0x4',
      '0x5',
      '0x6',
      '0x7',
    ]);
    expect(result).toEqual([
      {
        ctHash: '0x1',
        utype: FheTypes.Uint8,
      },
      {
        ctHash: '0x2',
        utype: FheTypes.Uint16,
      },
      {
        ctHash: '0x3',
        utype: FheTypes.Uint32,
      },
      {
        ctHash: '0x4',
        utype: FheTypes.Uint64,
      },
      {
        ctHash: '0x5',
        utype: FheTypes.Uint128,
      },
      {
        ctHash: '0x6',
        utype: FheTypes.Bool,
      },
      {
        ctHash: '0x7',
        utype: FheTypes.Uint160,
      },
    ]);
  });
});

// Struct-array returns (`tuple[]` / `tuple[N]`) — e.g. a batch getter returning
// `Order[]`. The regression: the array itself was processed as one tuple, so the
// named-component lookups found nothing and the result collapsed to `{}`.
const StructArrayABI = [
  {
    type: 'function',
    name: 'fnReturnStructArray',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct ABITest.ContainsEncryptedResult[]',
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
    // Hand-written ABI shape: no internalType fields at all.
    type: 'function',
    name: 'fnReturnPlainStructArray',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'owner', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fnReturnStructArrayFixed',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[2]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'owner', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

describe('transformEncryptedReturnTypes: struct arrays', () => {
  it('should transform each element of a struct array (encrypted fields included)', () => {
    const result = transformEncryptedReturnTypes(StructArrayABI, 'fnReturnStructArray', [
      { value: 1n, encryptedResult: '0x1' },
      { value: 2n, encryptedResult: '0x2' },
    ]);
    expect(result).toEqual([
      { value: 1n, encryptedResult: { ctHash: '0x1', utype: FheTypes.Uint32 } },
      { value: 2n, encryptedResult: { ctHash: '0x2', utype: FheTypes.Uint32 } },
    ]);
  });

  it('should keep a plain struct array intact (hand-written ABI, no internalType)', () => {
    const rows = [
      { id: 1n, owner: '0xaaaa000000000000000000000000000000000001' },
      { id: 2n, owner: '0xaaaa000000000000000000000000000000000002' },
    ];
    const result = transformEncryptedReturnTypes(StructArrayABI, 'fnReturnPlainStructArray', rows);
    expect(result).toEqual(rows);
  });

  it('should preserve an empty struct array', () => {
    const result = transformEncryptedReturnTypes(StructArrayABI, 'fnReturnPlainStructArray', []);
    expect(result).toEqual([]);
  });

  it('should enforce the declared length of a fixed-size struct array', () => {
    expect(() =>
      transformEncryptedReturnTypes(StructArrayABI, 'fnReturnStructArrayFixed', [
        { id: 1n, owner: '0xaaaa000000000000000000000000000000000001' },
      ] as never)
    ).toThrow(/size mismatch/i);
  });
});
