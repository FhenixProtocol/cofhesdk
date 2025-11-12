// FHE Types for the current CoFHE SDK
export type FheTypeValue = 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'bool' | 'address';

export interface FheTypeOption {
  label: string;
  value: FheTypeValue;
  maxValue: bigint | null;
  description: string;
}

export const FheTypesList: FheTypeOption[] = [
  {
    label: 'Encrypted Bool',
    value: 'bool',
    maxValue: BigInt(1), // 0 or 1
    description: 'Boolean value (true/false)',
  },
  {
    label: 'Encrypted Uint8',
    value: 'uint8',
    maxValue: BigInt(2 ** 8 - 1), // 255
    description: '8-bit unsigned integer (0 to 255)',
  },
  {
    label: 'Encrypted Uint16',
    value: 'uint16',
    maxValue: BigInt(2 ** 16 - 1), // 65,535
    description: '16-bit unsigned integer (0 to 65,535)',
  },
  {
    label: 'Encrypted Uint32',
    value: 'uint32',
    maxValue: BigInt(2 ** 32 - 1), // 4,294,967,295
    description: '32-bit unsigned integer (0 to 4,294,967,295)',
  },
  {
    label: 'Encrypted Uint64',
    value: 'uint64',
    maxValue: BigInt(2 ** 64 - 1), // 18,446,744,073,709,551,615
    description: '64-bit unsigned integer (0 to 18,446,744,073,709,551,615)',
  },
  {
    label: 'Encrypted Uint128',
    value: 'uint128',
    maxValue: BigInt(2 ** 128 - 1), // Very large number
    description: '128-bit unsigned integer',
  },
  {
    label: 'Encrypted Address',
    value: 'address',
    maxValue: null, // Address validation is different
    description: 'Ethereum address (0x...)',
  },
];

export const NOOP_CALLBACK = () => () => {};
