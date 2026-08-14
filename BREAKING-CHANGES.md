# Breaking changes

## Permit renamed to ACP (complete)

Every remaining Permit name is now ACP. Mechanical migration: replace the tokens Permit/permit/PERMIT (and plurals) with ACP/acp/ACP in identifiers imported from this SDK.

- Types: SelfPermit/SharingPermit/RecipientPermit -> SelfACP/SharingACP/RecipientACP; SerializedPermit -> SerializedACP.
- Methods: getOrCreateSelfPermit -> getOrCreateSelfACP; withPermit/withoutPermit -> withACP/withoutACP.
- React hooks: useCofhePermits -> useCofheACPs, useCofheActivePermit -> useCofheActiveACP, useCofheAllPermits -> useCofheAllACPs, useCofheRemovePermit -> useCofheRemoveACP, useCofheSelectPermit -> useCofheSelectACP, useCofheCreatePermit -> useCofheCreateACP, useCofheNavigateToCreatePermit -> useCofheNavigateToCreateACP, useWatchPermitStatus -> useWatchACPStatus; type PermitState -> ACPState.
- React components: PermitCard -> ACPCard, PermitItem -> ACPItem, PermitInfoModal -> ACPInfoModal, PermitDetailsModal -> ACPDetailsModal, PermitTypeInfoModal -> ACPTypeInfoModal, and the floating-button page tree (pages/permits/** -> pages/acps/**).
- Error codes: CofheErrorCode.Permit* members and their PERMIT\_* string values -> ACP*/ACP\_*.
- Entrypoint: @cofhe/sdk/permits -> @cofhe/sdk/acps.
- Config keys (see "Config keys" below): defaultPermitExpiration -> defaultACPExpiration, and the four react `react.*` keys.
- Storage: the persisted store key changed and old data is not migrated; stored ACPs are re-created on next use.

Not renamed: English words (permitted, isPermittedCofheEnvironment), protocol-mirroring contract interfaces (isAllowedWithPermission), licenses, historical changelogs, and the "before" code samples below (they describe the old world by design).

## ACP-era chains only

The SDK no longer serves pre-upgrade (V2 `Permission`) chains: the ACL must sign as EIP-712 domain version "2" (ACP / Permit V3). ACP creation on a V2 chain fails with an explicit error instead of producing signatures the chain cannot verify.

### Backend error codes: `acp_*` replaces `permit_*`

The `permit_*` error codes emitted by pre-upgrade decryption backends are no
longer recognized; ACP-era backends emit `acp_*`. Seven codes correspond 1:1
and map onto the same stable `CofheErrorCode` values as before:

| Wire code              | HTTP | `CofheErrorCode`                                |
| ---------------------- | ---- | ----------------------------------------------- |
| `acp_malformed`        | 400  | `ACPMalformed`                                  |
| `acp_denied`           | 401  | `ACPDenied` (also covers revocation, see below) |
| `acp_expired`          | 401  | `ACPExpired`                                    |
| `acp_invalid`          | 401  | `ACPInvalid`                                    |
| `acp_required`         | 400  | `ACPRequired`                                   |
| `acp_verifier_error`   | 502  | `ACPVerifierError`                              |
| `acp_verifier_timeout` | 504  | `ACPVerifierTimeout`                            |

There is no `acp_revoked` wire code by design: ACP-era backends no longer
distinguish revocation from no-access or scope-miss — all three come back as
`acp_denied`. `CofheErrorCode.ACPRevoked` is a new enum member for callers that
determine revocation themselves (e.g. via `client.acp.isACPRevoked`); it is
never produced from a backend response.

All breaking changes in the ACP migration, in one place. Applies to `@cofhe/sdk`, the mock contracts, and the on-chain ACL. **There are no deprecated aliases — old names are removed** so the compiler points at every site that needs attention.

## TL;DR migration

```ts
// before
import { PermitUtils, type Permit, type Permission } from '@cofhe/sdk/permits';
const permit = await client.permits.createSelf({ issuer });
const permission = PermitUtils.getPermission(permit);

// after
import { ACPUtils, type ACP, type ACPPublic } from '@cofhe/sdk/acps';
const acp = await client.acp.createSelf({ issuer });
const acpPublic = ACPUtils.getPublic(acp);
```

Existing signed ACPs **do not verify** against the upgraded ACL (typehashes and domain version changed). Recreate them after upgrading — the SDK's store migration wipes retired-format ACPs automatically.

## Renames (removed, not deprecated)

| Old                                          | New                               |
| -------------------------------------------- | --------------------------------- |
| `Permit` (type)                              | `ACP`                             |
| `Permission` (type)                          | `ACPPublic`                       |
| `PermitUtils`                                | `ACPUtils`                        |
| `client.permits.*`                           | `client.acp.*`                    |
| `PermitUtils.getPermission()`                | `ACPUtils.getPublic()`            |
| `validatorId` / `validatorContract` (fields) | `revokerData` / `revokerContract` |
| `TimestampBasedACPValidator` (contract)      | `ACPTimestampRevoker`             |
| docs `/sdk/permits`                          | `/sdk/acp`                        |

The `acp.*` config block (`defaultRevoker`, `defaultContractScopes`, `sharingRegistry`) is new
surface, not a rename — there was no `permit.*` config block before.

`permission` variables are named `acp` throughout the codebase (Solidity params included).

## Type structure

`ACPPrivate` and `ACPPublic` are top-level types; `ACP` is the union of both:

```ts
interface ACPPrivate {
  hash: string;
  name: string;
  type: 'self' | 'sharing' | 'recipient';
  sealingPrivateKey: Hex; // was: sealingPair: SealingKey (class instance)
  _signedDomain?: EIP712Domain;
}

interface ACPPublic {
  issuer: Hex;
  expiration: number;
  recipient: Hex;
  revokerData: number; // was: validatorId
  revokerContract: Hex; // was: validatorContract
  scope: number; // NEW: 0 Global | 1 Contract | 2 Handles
  contracts: Hex[]; // NEW: contract scope list
  handles: Hex[]; // NEW: bytes32 handle scope list
  sealingKey: Hex;
  issuerSignature: Hex;
  recipientSignature: Hex;
}

type ACP = ACPPrivate & ACPPublic;
```

- The sealing keypair is flattened to two hex fields. The `SealingKey` class is **removed** — `GenerateSealingKey()` returns a plain `SealingKeyPair { privateKey: Hex; publicKey: Hex }`, and `seal()` / `unsealWithPrivateKey()` are standalone functions.
- An ACP is plain JSON-serializable: `SerializedACP = ACP` (no serialize/deserialize special-casing).
- `handles` are **bytes32 hex strings** (`0x` + 64 hex chars), not `bigint`s.

## EIP-712 signing (invalidates existing signatures)

|               | Old (V2)                                              | New (ACP)                                                                                           |
| ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Domain        | `("ACL", "1")`                                        | `("ACL", "2")` — served by the ACL itself                                                           |
| Primary types | `PermissionedV2IssuerSelf` / `…Shared` / `…Recipient` | `ACPIssuerSelf` / `ACPIssuerShared` / `ACPRecipient`                                                |
| Fields        | `validatorId uint256, validatorContract address`      | `revokerData uint256, revokerContract address, scope uint8, contracts address[], handles bytes32[]` |

Pinned typehashes (enforced by freeze tests on both sides):

```
ACPIssuerSelf   0x0fb7b9df91360518f2617af1188c0c4675b99cdd742b6b779137cb8fedc8c348
ACPIssuerShared 0x4aa934032eb375f7abe059849ea8ea61b18b8340b17d1426f22d0830c65e4e51
ACPRecipient    0xa61bec9390ffc1eea10897f1dc01a2abf1b8210f228d8235fb672f8754f639d6
```

## On-chain (ACL)

- `isAllowedWithPermission` keeps its name but its parameter is now the `ACP` struct; `checkPermitValidity` is **removed** — use `checkPermissionValidity(ACP)`.
- `struct ACP` replaces `struct Permission` — renamed revoker fields plus the new scope fields (`scope`, `contracts`, `handles bytes32[]`).
- ACP verification and the EIP-712 domain live on the ACL itself.
- `TaskManager.isAllowedWithPermission` likewise keeps its name with the `ACP` struct parameter (the old `Permission` overload is gone).
- Scope semantics: scopes narrow the issuer's existing ACL access, never widen it (Global passes; Contract intersects existing allowances; Handles matches the listed ciphertexts).

## Decryption API payload

The ACP object sent to the decryption backend changed keys:

| Old                                 | New                                                    |
| ----------------------------------- | ------------------------------------------------------ |
| `validatorId` / `validatorContract` | `revokerData` / `revokerContract`                      |
| —                                   | `scope: 0 \| 1 \| 2` (new)                             |
| —                                   | `contracts: address[]`, `handles: bytes32-hex[]` (new) |

## Config keys

Renamed config keys. Both config schemas now **reject unknown keys** instead of stripping them, and
name the replacement for any stale key — previously a renamed key was silently dropped and its
replacement fell back to a default, with no error and no warning.

| Old (`0.6.x`)                          | New                                 | Silent default it used to fall back to |
| -------------------------------------- | ----------------------------------- | -------------------------------------- |
| `defaultPermitExpiration`              | `defaultACPExpiration`              | 30 days                                |
| `react.shareablePermits`               | `react.shareableACPs`               | `false`                                |
| `react.autogeneratePermits`            | `react.autogenerateACPs`            | `true`                                 |
| `react.permitExpirationOptions`        | `react.acpExpirationOptions`        | built-in option list                   |
| `react.defaultPermitExpirationSeconds` | `react.defaultACPExpirationSeconds` | 1 week                                 |

## Storage

- ACP store version bumped to 3. Older stored ACPs are wiped on load — they were signed with retired EIP-712 types and cannot verify anyway. Users re-create on next use.
- The exported share JSON uses `scope` / `revokerData` / `revokerContract` keys.

## Sharing export

- `ACPUtils.export()` returns a fixed `SharedACP` shape: every public field always present (zero-values instead of omissions), aligned with `ACPPublic` and the on-chain sharing payload.
- `export()` **throws** for non-sharing ACPs (the payload includes the issuer signature) and for unsigned sharing ACPs (the recipient could not import them anyway).
