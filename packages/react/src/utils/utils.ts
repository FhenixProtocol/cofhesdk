import {
  Encryptable,
  type EncryptableAddress,
  type EncryptableBool,
  type EncryptableItem,
  type EncryptableUint128,
  type EncryptableUint16,
  type EncryptableUint32,
  type EncryptableUint64,
  type EncryptableUint8,
} from '@cofhe/sdk';

// FHE Types for the current CoFHE SDK
export type FheTypeValue = 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'bool' | 'address';

export function isFheTypeValueUint8(value: FheTypeValue): value is Extract<FheTypeValue, 'uint8'> {
  return value === 'uint8';
}

export function isFheTypeValueUint16(value: FheTypeValue): value is Extract<FheTypeValue, 'uint16'> {
  return value === 'uint16';
}

export function isFheTypeValueUint32(value: FheTypeValue): value is Extract<FheTypeValue, 'uint32'> {
  return value === 'uint32';
}

export function isFheTypeValueUint64(value: FheTypeValue): value is Extract<FheTypeValue, 'uint64'> {
  return value === 'uint64';
}

export function isFheTypeValueUint128(value: FheTypeValue): value is Extract<FheTypeValue, 'uint128'> {
  return value === 'uint128';
}

export function isFheTypeValueBool(value: FheTypeValue): value is 'bool' {
  return value === 'bool';
}

export function isFheTypeValueAddress(value: FheTypeValue): value is 'address' {
  return value === 'address';
}

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

/* eslint-disable no-unused-vars, no-redeclare */
export function createEncryptableItemTyped(
  value: bigint | string,
  type: Extract<FheTypeValue, 'uint8'>
): EncryptableUint8;
export function createEncryptableItemTyped(
  value: bigint | string,
  type: Extract<FheTypeValue, 'uint16'>
): EncryptableUint16;
export function createEncryptableItemTyped(
  value: bigint | string,
  type: Extract<FheTypeValue, 'uint32'>
): EncryptableUint32;
export function createEncryptableItemTyped(
  value: bigint | string,
  type: Extract<FheTypeValue, 'uint64'>
): EncryptableUint64;
export function createEncryptableItemTyped(
  value: bigint | string,
  type: Extract<FheTypeValue, 'uint128'>
): EncryptableUint128;
export function createEncryptableItemTyped(value: boolean, type: Extract<FheTypeValue, 'bool'>): EncryptableBool;
export function createEncryptableItemTyped(value: string, type: Extract<FheTypeValue, 'address'>): EncryptableAddress;
export function createEncryptableItemTyped(
  value: bigint | boolean | string,
  type: Extract<FheTypeValue, 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'bool' | 'address'>
):
  | EncryptableUint8
  | EncryptableUint16
  | EncryptableUint32
  | EncryptableUint64
  | EncryptableUint128
  | EncryptableBool
  | EncryptableAddress {
  switch (type) {
    case 'uint8':
      if (typeof value !== 'bigint' && typeof value !== 'string') throw new Error('uint8 expects bigint');
      return Encryptable.uint8(value);
    case 'uint16':
      if (typeof value !== 'bigint' && typeof value !== 'string') throw new Error('uint16 expects bigint');
      return Encryptable.uint16(value);
    case 'uint32':
      if (typeof value !== 'bigint' && typeof value !== 'string') throw new Error('uint32 expects bigint');
      return Encryptable.uint32(value);
    case 'uint64':
      if (typeof value !== 'bigint' && typeof value !== 'string') throw new Error('uint64 expects bigint');
      return Encryptable.uint64(value);
    case 'uint128':
      if (typeof value !== 'bigint' && typeof value !== 'string') throw new Error('uint128 expects bigint');
      return Encryptable.uint128(value);
    case 'bool':
      if (typeof value !== 'boolean') throw new Error('bool expects boolean');
      return Encryptable.bool(value);
    case 'address':
      if (typeof value !== 'string') throw new Error('address expects string');
      return Encryptable.address(value);
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

/* eslint-enable no-unused-vars, no-redeclare */

// export function createEncryptableItemTyped(value: InputTypeToValueMap<T>, type: T) {
//   switch (type) {
//     case 'bool':
//       return Encryptable.bool(value as boolean);
//     case 'uint8':
//       return Encryptable.uint8(value as bigint);
//     case 'uint16':
//       encryptableItem = Encryptable.uint16(BigInt(convertedValue));
//       break;
//     case 'uint32':
//       encryptableItem = Encryptable.uint32(BigInt(convertedValue));
//       break;
//     case 'uint64':
//       encryptableItem = Encryptable.uint64(BigInt(convertedValue));
//       break;
//     case 'uint128':
//       encryptableItem = Encryptable.uint128(BigInt(convertedValue));
//       break;
//     case 'address':
//       encryptableItem = Encryptable.address(convertedValue as string | bigint);
//       break;
//     default:
//       encryptableItem = Encryptable.uint32(BigInt(convertedValue));
//   }
// }

export function createEncryptableItem(value: string, type: FheTypeValue): EncryptableItem {
  // Convert value based on type
  let convertedValue: number | bigint | boolean | string;

  if (type === 'bool') {
    convertedValue = value.toLowerCase() === 'true' || value === '1';
  } else if (type === 'address') {
    convertedValue = value as string | bigint;
  } else {
    // Numeric types
    convertedValue = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
  }

  // Create encryptable item
  let encryptableItem: EncryptableItem;
  switch (type) {
    case 'bool':
      encryptableItem = Encryptable.bool(convertedValue as boolean);
      break;
    case 'uint8':
      encryptableItem = Encryptable.uint8(BigInt(convertedValue));
      break;
    case 'uint16':
      encryptableItem = Encryptable.uint16(BigInt(convertedValue));
      break;
    case 'uint32':
      encryptableItem = Encryptable.uint32(BigInt(convertedValue));
      break;
    case 'uint64':
      encryptableItem = Encryptable.uint64(BigInt(convertedValue));
      break;
    case 'uint128':
      encryptableItem = Encryptable.uint128(BigInt(convertedValue));
      break;
    case 'address':
      encryptableItem = Encryptable.address(convertedValue as string | bigint);
      break;
    default:
      encryptableItem = Encryptable.uint32(BigInt(convertedValue));
  }
  return encryptableItem;
}
