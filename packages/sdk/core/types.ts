export type TfheInitializer = () => Promise<boolean>;

export interface IStorage {
  getItem: (name: string) => Promise<any>;
  setItem: (name: string, value: any) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}

export type Primitive = null | undefined | string | number | boolean | symbol | bigint;
export type LiteralToPrimitive<T> = T extends number
  ? number
  : T extends bigint
    ? bigint
    : T extends string
      ? string
      : T extends boolean
        ? boolean
        : T extends symbol
          ? symbol
          : T extends null
            ? null
            : T extends undefined
              ? undefined
              : never;

// FHE TYPES

export enum FheTypes {
  Bool = 0,
  Uint4 = 1,
  Uint8 = 2,
  Uint16 = 3,
  Uint32 = 4,
  Uint64 = 5,
  Uint128 = 6,
  Uint160 = 7,
  Uint256 = 8,
  Uint512 = 9,
  Uint1024 = 10,
  Uint2048 = 11,
  Uint2 = 12,
  Uint6 = 13,
  Uint10 = 14,
  Uint12 = 15,
  Uint14 = 16,
  Int2 = 17,
  Int4 = 18,
  Int6 = 19,
  Int8 = 20,
  Int10 = 21,
  Int12 = 22,
  Int14 = 23,
  Int16 = 24,
  Int32 = 25,
  Int64 = 26,
  Int128 = 27,
  Int160 = 28,
  Int256 = 29,
}

/**
 * List of All FHE uint types (excludes bool and address)
 */
export const FheUintUTypes = [
  FheTypes.Uint8,
  FheTypes.Uint16,
  FheTypes.Uint32,
  FheTypes.Uint64,
  FheTypes.Uint128,
  // [U256-DISABLED]
  // FheTypes.Uint256,
] as const;
export type FheUintUTypesType = (typeof FheUintUTypes)[number];

/**
 * List of All FHE types (uints, bool, and address)
 */
export const FheAllUTypes = [
  FheTypes.Bool,
  FheTypes.Uint8,
  FheTypes.Uint16,
  FheTypes.Uint32,
  FheTypes.Uint64,
  FheTypes.Uint128,
  // [U256-DISABLED]
  // FheTypes.Uint256,
  FheTypes.Uint160,
] as const;
type FheAllUTypesType = (typeof FheAllUTypes)[number];

// ENCRYPT

export type EncryptedNumber = {
  data: Uint8Array;
  securityZone: number;
};

export type EncryptedItemInput<TSignature = string> = {
  ctHash: bigint;
  securityZone: number;
  utype: FheTypes;
  signature: TSignature;
};

export function assertCorrectEncryptedItemInput(
  input: EncryptedItemInput
): asserts input is EncryptedItemInput<`0x${string}`> {
  if (!input.signature.startsWith('0x')) throw new Error('Signature must be a hex string starting with 0x');
}

export type EncryptedBoolInput = EncryptedItemInput & {
  utype: FheTypes.Bool;
};
export type EncryptedUint8Input = EncryptedItemInput & {
  utype: FheTypes.Uint8;
};
export type EncryptedUint16Input = EncryptedItemInput & {
  utype: FheTypes.Uint16;
};
export type EncryptedUint32Input = EncryptedItemInput & {
  utype: FheTypes.Uint32;
};
export type EncryptedUint64Input = EncryptedItemInput & {
  utype: FheTypes.Uint64;
};
export type EncryptedUint128Input = EncryptedItemInput & {
  utype: FheTypes.Uint128;
};
export type EncryptedUint256Input = EncryptedItemInput & {
  utype: FheTypes.Uint256;
};
export type EncryptedAddressInput = EncryptedItemInput & {
  utype: FheTypes.Uint160;
};

export type EncryptableBool = {
  data: boolean;
  utype: FheTypes.Bool;
};
export type EncryptableUint8 = {
  data: string | bigint;
  utype: FheTypes.Uint8;
};
export type EncryptableUint16 = {
  data: string | bigint;
  utype: FheTypes.Uint16;
};
export type EncryptableUint32 = {
  data: string | bigint;
  utype: FheTypes.Uint32;
};
export type EncryptableUint64 = {
  data: string | bigint;
  utype: FheTypes.Uint64;
};
export type EncryptableUint128 = {
  data: string | bigint;
  utype: FheTypes.Uint128;
};
// [U256-DISABLED]
// export type EncryptableUint256 = {
//   data: string | bigint;
//   utype: FheTypes.Uint256;
// };
export type EncryptableAddress = {
  data: string | bigint;
  utype: FheTypes.Uint160;
};

export const Encryptable = {
  bool: (data: EncryptableBool['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Bool }) as EncryptableBool,
  address: (data: EncryptableAddress['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint160 }) as EncryptableAddress,
  uint8: (data: EncryptableUint8['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint8 }) as EncryptableUint8,
  uint16: (data: EncryptableUint16['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint16 }) as EncryptableUint16,
  uint32: (data: EncryptableUint32['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint32 }) as EncryptableUint32,
  uint64: (data: EncryptableUint64['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint64 }) as EncryptableUint64,
  uint128: (data: EncryptableUint128['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint128 }) as EncryptableUint128,
  // [U256-DISABLED]
  // uint256: (data: EncryptableUint256['data'], securityZone = 0) =>
  //   ({ data, securityZone, utype: FheTypes.Uint256 }) as EncryptableUint256,
} as const;

export type EncryptableItem =
  | EncryptableBool
  | EncryptableUint8
  | EncryptableUint16
  | EncryptableUint32
  | EncryptableUint64
  | EncryptableUint128
  // [U256-DISABLED]
  // | EncryptableUint256
  | EncryptableAddress;

// COFHE Encrypt
export type EncryptableToEncryptedItemInputMap<E extends EncryptableItem> = E extends EncryptableBool
  ? EncryptedBoolInput
  : E extends EncryptableUint8
    ? EncryptedUint8Input
    : E extends EncryptableUint16
      ? EncryptedUint16Input
      : E extends EncryptableUint32
        ? EncryptedUint32Input
        : E extends EncryptableUint64
          ? EncryptedUint64Input
          : E extends EncryptableUint128
            ? EncryptedUint128Input
            : // [U256-DISABLED]
              // : E extends EncryptableUint256
              //   ? EncryptedUint256Input
              E extends EncryptableAddress
              ? EncryptedAddressInput
              : never;

export type EncryptedItemInputs<T> = T extends Primitive
  ? LiteralToPrimitive<T>
  : T extends EncryptableItem
    ? EncryptableToEncryptedItemInputMap<T>
    : {
        [K in keyof T]: EncryptedItemInputs<T[K]>;
      };

export function isEncryptableItem(value: unknown): value is EncryptableItem {
  return (
    // Is object and exists
    typeof value === 'object' &&
    value !== null &&
    // Has securityZone
    'securityZone' in value &&
    typeof value.securityZone === 'number' &&
    // Has utype
    'utype' in value &&
    FheAllUTypes.includes(value.utype as FheAllUTypesType) &&
    // Has data
    'data' in value &&
    ['string', 'number', 'bigint', 'boolean'].includes(typeof value.data)
  );
}

export enum EncryptStep {
  InitTfhe = 'initTfhe',
  FetchKeys = 'fetchKeys',
  Pack = 'pack',
  Prove = 'prove',
  Verify = 'verify',
}

export function isLastEncryptionStep(step: EncryptStep): boolean {
  return step === EncryptStep.Verify;
}

export type EncryptStepCallbackContext = Record<string, any> & {
  isStart: boolean;
  isEnd: boolean;
  duration: number;
};
export type EncryptStepCallbackFunction = (state: EncryptStep, context?: EncryptStepCallbackContext) => void;

// DECRYPT

export type UnsealedItem<U extends FheTypes> = U extends FheTypes.Bool
  ? boolean
  : U extends FheTypes.Uint160
    ? string
    : U extends FheUintUTypesType
      ? bigint
      : never;
