import type { EncryptInputsBuilder, EncryptInputsBuilderUnset } from '../core/encrypt/encryptInputsBuilder.js';
import type {
  FheTypes,
  EncryptableBool,
  EncryptableUint8,
  EncryptableUint16,
  EncryptableUint32,
  EncryptableUint64,
  EncryptableUint128,
  EncryptableAddress,
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

// ─── 1. EncryptInputsBuilder takes a single type parameter (no HPP toggle) ───

type _Builder_bool = Assert<Equals<typeof builder_bool, EncryptInputsBuilder<[EncryptableBool]>>>;
type _Builder_boolUint32 = Assert<
  Equals<typeof builder_bool_uint32, EncryptInputsBuilder<[EncryptableBool, EncryptableUint32]>>
>;

// ─── 2. execute() always returns HashPlusProofResult (hashes + one shared signature) ──

type _Exec_bool = Assert<
  Equals<Awaited<ReturnType<typeof builder_bool.execute>>, [ExternalBoolHash, ExternalHashProof]>
>;

type _Exec_uint32 = Assert<
  Equals<Awaited<ReturnType<typeof builder_uint32.execute>>, [ExternalUint32Hash, ExternalHashProof]>
>;

type _Exec_bool_uint32 = Assert<
  Equals<
    Awaited<ReturnType<typeof builder_bool_uint32.execute>>,
    [ExternalBoolHash, ExternalUint32Hash, ExternalHashProof]
  >
>;

type _Exec_all = Assert<
  Equals<
    Awaited<ReturnType<typeof builder_all.execute>>,
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

// ─── 4. execute() is gated behind setConsumingContract() ─────────────────────
// `client.encryptInputs(...)` hands back the Unset builder: the verifier binds the consuming
// contract into the signed digest, so no batch can be produced before the caller commits to one.

declare const unset_uint32: EncryptInputsBuilderUnset<[EncryptableUint32]>;

// `execute` is absent from the unset builder...
type _Execute_absent_when_unset = Assert<Equals<'execute' extends keyof typeof unset_uint32 ? true : false, false>>;

// ...and present once a consuming contract has been set.
type _Execute_present_after_set = Assert<
  Equals<'execute' extends keyof ReturnType<typeof unset_uint32.setConsumingContract> ? true : false, true>
>;

// Chaining is checked through real call expressions rather than `ReturnType`: these methods are
// overloaded on `this`, and `ReturnType` would collapse them to the last overload regardless of
// the receiver's actual state.
function _chainingPreservesBuilderState(
  unset: EncryptInputsBuilderUnset<[EncryptableUint32]>,
  set: EncryptInputsBuilder<[EncryptableUint32]>
): void {
  // Other chainable setters preserve the unset state rather than silently unlocking execute().
  const stillUnset = unset.setAccount('0x0').setChainId(1);
  type _StillUnset = Assert<Equals<'execute' extends keyof typeof stillUnset ? true : false, false>>;

  // Committing to a consuming contract is what unlocks execute()...
  const ready = unset.setConsumingContract('0x0');
  type _Ready = Assert<Equals<'execute' extends keyof typeof ready ? true : false, true>>;

  // ...and further chaining on a set builder keeps it available.
  const stillReady = set.setAccount('0x0').setChainId(1);
  type _StillReady = Assert<Equals<'execute' extends keyof typeof stillReady ? true : false, true>>;
}
