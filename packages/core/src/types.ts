/* eslint-disable no-unused-vars */

import {
  CreateSelfPermitOptions,
  Permit,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
  PermitUtils,
} from '@cofhesdk/permits';
import { PublicClient, WalletClient } from 'viem';
import { CofhesdkConfig } from './config';
import { DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder';
import { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify';
import { FheKeySerializer } from './fetchKeys';
import { permits } from './permits';
import { Result } from './result';
import { CofhesdkError } from './error';

// UTILS

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

// CLIENT

export type CofhesdkClient = {
  // --- state access ---
  getSnapshot(): CofhesdkClientConnectionState;
  subscribe(listener: Listener): () => void;

  // --- initialization results ---
  // (functions that may be run during initialization based on config)
  readonly initializationResults: {
    keyFetchResult: Promise<Result<boolean>>;
  };

  // --- convenience flags (read-only) ---
  readonly connected: boolean;
  readonly connecting: boolean;

  // --- config & platform-specific ---
  readonly config: CofhesdkConfig;

  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<Result<boolean>>;
  /**
   * Types docstring
   */
  encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilder<[...T]>;
  decryptHandle<U extends FheTypes>(ctHash: bigint, utype: U): DecryptHandlesBuilder<U>;
  permits: CofhesdkClientPermits;
};

export type CofhesdkClientConnectionState = {
  connected: boolean;
  connecting: boolean;
  connectError: unknown | undefined;
  chainId: number | undefined;
  account: string | undefined;
};

type Listener = (snapshot: CofhesdkClientConnectionState) => void;

export type CofhesdkClientPermits = {
  getSnapshot: typeof permits.getSnapshot;
  subscribe: typeof permits.subscribe;

  // Creation methods (require connection, no params)
  createSelf: (options: CreateSelfPermitOptions) => Promise<Result<Permit>>;
  createSharing: (options: CreateSharingPermitOptions) => Promise<Result<Permit>>;
  importShared: (options: ImportSharedPermitOptions | any | string) => Promise<Result<Permit>>;

  // Retrieval methods (chainId/account optional)
  getPermit: (hash: string, chainId?: number, account?: string) => Promise<Result<Permit | undefined>>;
  getPermits: (chainId?: number, account?: string) => Promise<Result<Record<string, Permit>>>;
  getActivePermit: (chainId?: number, account?: string) => Promise<Result<Permit | undefined>>;
  getActivePermitHash: (chainId?: number, account?: string) => Promise<Result<string | undefined>>;

  // Mutation methods (chainId/account optional)
  selectActivePermit: (hash: string, chainId?: number, account?: string) => Promise<Result<void>>;
  removePermit: (hash: string, chainId?: number, account?: string) => Promise<Result<void>>;
  removeActivePermit: (chainId?: number, account?: string) => Promise<Result<void>>;

  // Utils
  getHash: typeof PermitUtils.getHash;
  serialize: typeof PermitUtils.serialize;
  deserialize: typeof PermitUtils.deserialize;
};

export type CofhesdkClientParams = {
  config: CofhesdkConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeySerializer: FheKeySerializer;
  compactPkeCrsSerializer: FheKeySerializer;
};

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
  FheTypes.Uint256,
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
  FheTypes.Uint256,
  FheTypes.Uint160,
] as const;
type FheAllUTypesType = (typeof FheAllUTypes)[number];

// ENCRYPT

export type EncryptedNumber = {
  data: Uint8Array;
  securityZone: number;
};

export type EncryptedItemInput = {
  ctHash: bigint;
  securityZone: number;
  utype: FheTypes;
  signature: string;
};
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
export type EncryptableUint256 = {
  data: string | bigint;
  utype: FheTypes.Uint256;
};
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
  uint256: (data: EncryptableUint256['data'], securityZone = 0) =>
    ({ data, securityZone, utype: FheTypes.Uint256 }) as EncryptableUint256,
} as const;

export type EncryptableItem =
  | EncryptableBool
  | EncryptableUint8
  | EncryptableUint16
  | EncryptableUint32
  | EncryptableUint64
  | EncryptableUint128
  | EncryptableUint256
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
            : E extends EncryptableUint256
              ? EncryptedUint256Input
              : E extends EncryptableAddress
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
  FetchKeys = 'fetchKeys',
  Pack = 'pack',
  Prove = 'prove',
  Verify = 'verify',
  Done = 'done',
}

export type EncryptSetStateFn = (state: EncryptStep) => void;

// DECRYPT

export type UnsealedItem<U extends FheTypes> = U extends FheTypes.Bool
  ? boolean
  : U extends FheTypes.Uint160
    ? string
    : U extends FheUintUTypesType
      ? bigint
      : never;
