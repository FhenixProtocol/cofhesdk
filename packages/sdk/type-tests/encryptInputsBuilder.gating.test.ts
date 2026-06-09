import type { EncryptInputsBuilder } from '../core/encrypt/encryptInputsBuilder.js';
import type {
  FheTypes,
  EncryptableBool,
  EncryptableUint8,
  EncryptableUint16,
  EncryptableUint32,
  EncryptableUint64,
  EncryptableUint128,
  EncryptableAddress,
  EncryptedBoolInput,
  EncryptedUint8Input,
  EncryptedUint16Input,
  EncryptedUint32Input,
  EncryptedUint64Input,
  EncryptedUint128Input,
  EncryptedAddressInput,
  ExternalBoolHash,
  ExternalUint8Hash,
  ExternalUint16Hash,
  ExternalUint32Hash,
  ExternalUint64Hash,
  ExternalUint128Hash,
  ExternalAddressHash,
  ExternalHashProof,
  AnyExternalHash,
  EncryptableToExternalHashMap,
  ExternalItemHashes,
  HashPlusProofResult,
} from '../core/types.js';

// This file is compiled by `pnpm -C packages/sdk check:types`.
// Excluded from runtime test runs via vitest.config.mts (type-tests/**).

// ─── Equality helpers ─────────────────────────────────────────────────────────
// Uses the conditional-type-distribution trick for strict structural equality
// (handles branding, readonly, and nominal differences correctly).
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
// Produces a compile error if T is not `true` — i.e. if the Equals check failed.
type Assert<T extends true> = T;

// ─── Builder instances (declared, not constructed — pure type-level) ──────────

declare const builder_bool: EncryptInputsBuilder<[EncryptableBool]>;
declare const builder_uint32: EncryptInputsBuilder<[EncryptableUint32]>;
declare const builder_bool_uint32: EncryptInputsBuilder<[EncryptableBool, EncryptableUint32]>;
declare const builder_all: EncryptInputsBuilder<
  [
    EncryptableBool,
    EncryptableUint8,
    EncryptableUint16,
    EncryptableUint32,
    EncryptableUint64,
    EncryptableUint128,
    EncryptableAddress,
  ]
>;

// ─── 1. HPP type parameter defaults to false ──────────────────────────────────

type _DefaultHPP_bool = Assert<Equals<typeof builder_bool, EncryptInputsBuilder<[EncryptableBool], false>>>;
type _DefaultHPP_boolUint32 = Assert<
  Equals<typeof builder_bool_uint32, EncryptInputsBuilder<[EncryptableBool, EncryptableUint32], false>>
>;

// ─── 2. asHashPlusProof() transitions HPP to true ────────────────────────────

type _HPP_bool = Assert<
  Equals<ReturnType<typeof builder_bool.asHashPlusProof>, EncryptInputsBuilder<[EncryptableBool], true>>
>;
type _HPP_boolUint32 = Assert<
  Equals<
    ReturnType<typeof builder_bool_uint32.asHashPlusProof>,
    EncryptInputsBuilder<[EncryptableBool, EncryptableUint32], true>
  >
>;

// ─── 3. execute() default output (HPP = false) → EncryptedItemInputs ─────────

type _Exec_bool = Assert<Equals<Awaited<ReturnType<typeof builder_bool.execute>>, [EncryptedBoolInput]>>;

type _Exec_uint32 = Assert<Equals<Awaited<ReturnType<typeof builder_uint32.execute>>, [EncryptedUint32Input]>>;

type _Exec_bool_uint32 = Assert<
  Equals<Awaited<ReturnType<typeof builder_bool_uint32.execute>>, [EncryptedBoolInput, EncryptedUint32Input]>
>;

type _Exec_all = Assert<
  Equals<
    Awaited<ReturnType<typeof builder_all.execute>>,
    [
      EncryptedBoolInput,
      EncryptedUint8Input,
      EncryptedUint16Input,
      EncryptedUint32Input,
      EncryptedUint64Input,
      EncryptedUint128Input,
      EncryptedAddressInput,
    ]
  >
>;

// ─── 4. execute() HPP output (HPP = true) → HashPlusProofResult ──────────────

declare const builderHpp_bool: EncryptInputsBuilder<[EncryptableBool], true>;
declare const builderHpp_uint32: EncryptInputsBuilder<[EncryptableUint32], true>;
declare const builderHpp_bool_uint32: EncryptInputsBuilder<[EncryptableBool, EncryptableUint32], true>;
declare const builderHpp_all: EncryptInputsBuilder<
  [
    EncryptableBool,
    EncryptableUint8,
    EncryptableUint16,
    EncryptableUint32,
    EncryptableUint64,
    EncryptableUint128,
    EncryptableAddress,
  ],
  true
>;

type _ExecHPP_bool = Assert<
  Equals<Awaited<ReturnType<typeof builderHpp_bool.execute>>, [ExternalBoolHash, ExternalHashProof]>
>;

type _ExecHPP_uint32 = Assert<
  Equals<Awaited<ReturnType<typeof builderHpp_uint32.execute>>, [ExternalUint32Hash, ExternalHashProof]>
>;

type _ExecHPP_bool_uint32 = Assert<
  Equals<
    Awaited<ReturnType<typeof builderHpp_bool_uint32.execute>>,
    [ExternalBoolHash, ExternalUint32Hash, ExternalHashProof]
  >
>;

type _ExecHPP_all = Assert<
  Equals<
    Awaited<ReturnType<typeof builderHpp_all.execute>>,
    [
      ExternalBoolHash,
      ExternalUint8Hash,
      ExternalUint16Hash,
      ExternalUint32Hash,
      ExternalUint64Hash,
      ExternalUint128Hash,
      ExternalAddressHash,
      ExternalHashProof,
    ]
  >
>;

// Verify asHashPlusProof().execute() produces the same type as the direct HPP builder
type _ChainedHPP_bool_uint32 = Assert<
  Equals<
    Awaited<ReturnType<ReturnType<typeof builder_bool_uint32.asHashPlusProof>['execute']>>,
    [ExternalBoolHash, ExternalUint32Hash, ExternalHashProof]
  >
>;

// ─── 5. Branded type structure ────────────────────────────────────────────────
// External*Hash types are discriminated by `utype` matching the FheTypes enum

type _Brand_BoolHash = Assert<Equals<ExternalBoolHash['utype'], FheTypes.Bool>>;
type _Brand_Uint8Hash = Assert<Equals<ExternalUint8Hash['utype'], FheTypes.Uint8>>;
type _Brand_Uint16Hash = Assert<Equals<ExternalUint16Hash['utype'], FheTypes.Uint16>>;
type _Brand_Uint32Hash = Assert<Equals<ExternalUint32Hash['utype'], FheTypes.Uint32>>;
type _Brand_Uint64Hash = Assert<Equals<ExternalUint64Hash['utype'], FheTypes.Uint64>>;
type _Brand_Uint128Hash = Assert<Equals<ExternalUint128Hash['utype'], FheTypes.Uint128>>;
type _Brand_AddrHash = Assert<Equals<ExternalAddressHash['utype'], FheTypes.Uint160>>;
type _Brand_Proof = Assert<Equals<ExternalHashProof['_kind'], 'ExternalHashProof'>>;

// ─── 6. Cross-assignment guards (brands prevent mixing) ──────────────────────

const boolHash = null as unknown as ExternalBoolHash;
const uint32Hash = null as unknown as ExternalUint32Hash;
const proof = null as unknown as ExternalHashProof;

// @ts-expect-error ExternalBoolHash is not assignable to ExternalUint32Hash
const _a: ExternalUint32Hash = boolHash;
// @ts-expect-error ExternalUint32Hash is not assignable to ExternalBoolHash
const _b: ExternalBoolHash = uint32Hash;
// @ts-expect-error ExternalHashProof is not assignable to ExternalBoolHash (no utype)
const _c: ExternalBoolHash = proof;
// @ts-expect-error ExternalBoolHash is not assignable to ExternalHashProof (no _kind)
const _d: ExternalHashProof = boolHash;

// AnyExternalHash accepts all hash types but not ExternalHashProof
const _e: AnyExternalHash = boolHash; // OK
const _f: AnyExternalHash = uint32Hash; // OK
// @ts-expect-error ExternalHashProof is not assignable to AnyExternalHash
const _g: AnyExternalHash = proof;

// ─── 7. EncryptableToExternalHashMap covers all EncryptableItem variants ──────

type _Map_Bool = Assert<Equals<EncryptableToExternalHashMap<EncryptableBool>, ExternalBoolHash>>;
type _Map_Uint8 = Assert<Equals<EncryptableToExternalHashMap<EncryptableUint8>, ExternalUint8Hash>>;
type _Map_Uint16 = Assert<Equals<EncryptableToExternalHashMap<EncryptableUint16>, ExternalUint16Hash>>;
type _Map_Uint32 = Assert<Equals<EncryptableToExternalHashMap<EncryptableUint32>, ExternalUint32Hash>>;
type _Map_Uint64 = Assert<Equals<EncryptableToExternalHashMap<EncryptableUint64>, ExternalUint64Hash>>;
type _Map_Uint128 = Assert<Equals<EncryptableToExternalHashMap<EncryptableUint128>, ExternalUint128Hash>>;
type _Map_Addr = Assert<Equals<EncryptableToExternalHashMap<EncryptableAddress>, ExternalAddressHash>>;

// ─── 8. ExternalItemHashes maps a tuple preserving positions ─────────────────

type _ItemHashes_single = Assert<Equals<ExternalItemHashes<[EncryptableBool]>, [ExternalBoolHash]>>;

type _ItemHashes_mixed = Assert<
  Equals<ExternalItemHashes<[EncryptableBool, EncryptableUint32]>, [ExternalBoolHash, ExternalUint32Hash]>
>;

type _ItemHashes_all = Assert<
  Equals<
    ExternalItemHashes<
      [
        EncryptableBool,
        EncryptableUint8,
        EncryptableUint16,
        EncryptableUint32,
        EncryptableUint64,
        EncryptableUint128,
        EncryptableAddress,
      ]
    >,
    [
      ExternalBoolHash,
      ExternalUint8Hash,
      ExternalUint16Hash,
      ExternalUint32Hash,
      ExternalUint64Hash,
      ExternalUint128Hash,
      ExternalAddressHash,
    ]
  >
>;

// ─── 9. HashPlusProofResult appends ExternalHashProof after the hashes ────────

type _HPPResult_single = Assert<Equals<HashPlusProofResult<[EncryptableBool]>, [ExternalBoolHash, ExternalHashProof]>>;

type _HPPResult_mixed = Assert<
  Equals<
    HashPlusProofResult<[EncryptableBool, EncryptableUint32]>,
    [ExternalBoolHash, ExternalUint32Hash, ExternalHashProof]
  >
>;

type _HPPResult_all = Assert<
  Equals<
    HashPlusProofResult<
      [
        EncryptableBool,
        EncryptableUint8,
        EncryptableUint16,
        EncryptableUint32,
        EncryptableUint64,
        EncryptableUint128,
        EncryptableAddress,
      ]
    >,
    [
      ExternalBoolHash,
      ExternalUint8Hash,
      ExternalUint16Hash,
      ExternalUint32Hash,
      ExternalUint64Hash,
      ExternalUint128Hash,
      ExternalAddressHash,
      ExternalHashProof,
    ]
  >
>;
