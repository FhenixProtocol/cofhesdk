# Permit → ACP

"Permit" is now "ACP" (Access Control Permission), to stop it being confused with ERC-2612
permits. Old names are removed, not deprecated.

**Only rewrite identifiers that resolve to a `@cofhe/*` import.** A blind text replace will
corrupt unrelated code — see _Do not rename_ at the bottom.

## Entrypoint

```ts
// BEFORE
import { PermitUtils, type Permit, type Permission } from '@cofhe/sdk/permits';
// AFTER
import { ACPUtils, type ACP, type ACPPublic } from '@cofhe/sdk/acps';
```

## Types

| Before                                                               | After                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Permit`                                                             | `ACP`                                                       |
| `Permission`                                                         | `ACPPublic`                                                 |
| `SelfPermit` / `SharingPermit` / `RecipientPermit`                   | `SelfACP` / `SharingACP` / `RecipientACP`                   |
| `SerializedPermit`                                                   | `SerializedACP`                                             |
| `PermitMetadata`                                                     | `ACPMetadata`                                               |
| `PermitSignaturePrimaryType`                                         | `ACPSignaturePrimaryType`                                   |
| `SelfPermitOptions` / `SharingPermitOptions` / `ImportPermitOptions` | `SelfACPOptions` / `SharingACPOptions` / `ImportACPOptions` |

`ACPPrivate` and `ACPPublic` are now top-level types and `ACP` is their union.

## Client — note the namespace is singular

```ts
// BEFORE                              // AFTER
client.permits.createSelf(...)         client.acp.createSelf(...)
client.permits.getPermit(hash)         client.acp.getACP(hash)
client.permits.getPermits()            client.acp.getACPs()
client.permits.getActivePermit()       client.acp.getActiveACP()
client.permits.getActivePermitHash()   client.acp.getActiveACPHash()
client.permits.getOrCreateSelfPermit() client.acp.getOrCreateSelfACP()
client.permits.getOrCreateSharingPermit() client.acp.getOrCreateSharingACP()
client.permits.selectActivePermit()    client.acp.selectActiveACP()
client.permits.removePermit(hash)      client.acp.removeACP(hash)
client.permits.removeActivePermit()    client.acp.removeActiveACP()
```

`client.permits` → **`client.acp`** (singular). Types `CofheClientPermits` → `CofheClientACPs`,
`CofheClientPermitsClients` → `CofheClientACPsClients`.

New on the client (additive): `revokeACP`, `revokeAllACPs`, `isACPRevoked`, `shareOnChain`,
`getIncomingShares`, `importFromChain`, `dismissShare`, `cancelShare`.

## Decrypt builders

```ts
decryptForView(h, t).withPermit()        →  .withACP()
decryptForTx(h).withoutPermit()          →  .withoutACP()
.setPermitHash(hash)                     →  .setACPHash(hash)   // still deprecated
```

## Store helpers

`permitStore`→`acpStore`, `getPermit`→`getACP`, `getPermits`→`getACPs`,
`getActivePermit`→`getActiveACP`, `setPermit`→`setACP`, `removePermit`→`removeACP`,
`getActivePermitHash`→`getActiveACPHash`, `setActivePermitHash`→`setActiveACPHash`,
`removeActivePermitHash`→`removeActiveACPHash`, `PERMIT_STORE_DEFAULTS`→`ACP_STORE_DEFAULTS`.

## Validators

Every `*Permit*` validator becomes `*ACP*`: `SelfPermitOptionsValidator`→`SelfACPOptionsValidator`,
`validateSelfPermit`→`validateSelfACP`, `SharingPermitValidator`→`SharingACPValidator`,
`validateImportPermitOptions`→`validateImportACPOptions`, and so on.

## Structural changes that are not just renames

**Sealing keys.** The `SealingKey` class is removed. The keypair is flattened onto the ACP:

```ts
// BEFORE                          // AFTER
permit.sealingPair.publicKey       acp.sealingKey          // Hex
permit.sealingPair.privateKey      acp.sealingPrivateKey   // Hex
```

`GenerateSealingKey()` returns a plain `SealingKeyPair { privateKey: Hex; publicKey: Hex }`, and
`seal()` / `unsealWithPrivateKey()` are standalone exports.

**Renamed fields.** `validatorId` → `revokerData`, `validatorContract` → `revokerContract`.

**New scope fields** on `ACPPublic`: `scope` (`0` Global | `1` Contract | `2` Handles),
`contracts: Hex[]`, `handles: Hex[]`. Handles are **bytes32 hex strings**, not `bigint`s.

**`ACPUtils.export()`** returns a fixed `SharedACP` shape (every field present, zero-valued rather
than omitted) and now **throws** for non-sharing ACPs and for unsigned sharing ACPs.

**`PermitUtils.getPermission()`** → **`ACPUtils.getPublic()`**.

## EIP-712 signing and the on-chain ACL

Only relevant if the project signs ACPs itself, pins typehashes, or calls the ACL directly.
Going through the SDK means this is handled for you — but the domain bump is why stored ACPs stop
verifying (below).

|               | Old (V2)                                              | New (ACP)                                                                                           |
| ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Domain        | `("ACL", "1")`                                        | `("ACL", "2")` — served by the ACL itself                                                           |
| Primary types | `PermissionedV2IssuerSelf` / `…Shared` / `…Recipient` | `ACPIssuerSelf` / `ACPIssuerShared` / `ACPRecipient`                                                |
| Fields        | `validatorId uint256, validatorContract address`      | `revokerData uint256, revokerContract address, scope uint8, contracts address[], handles bytes32[]` |

Pinned typehashes, enforced by freeze tests on both the contract and SDK side:

```
ACPIssuerSelf   0x0fb7b9df91360518f2617af1188c0c4675b99cdd742b6b779137cb8fedc8c348
ACPIssuerShared 0x4aa934032eb375f7abe059849ea8ea61b18b8340b17d1426f22d0830c65e4e51
ACPRecipient    0xa61bec9390ffc1eea10897f1dc01a2abf1b8210f228d8235fb672f8754f639d6
```

On the ACL itself:

- `struct ACP` replaces `struct Permission`, and ACP verification plus the EIP-712 domain now live
  on the ACL rather than a separate verifier.
- `checkPermitValidity` is **removed** — use `checkPermissionValidity(ACP)`.
- `isAllowedWithPermission` keeps its name on both the ACL and the TaskManager, but takes the `ACP`
  struct; the old `Permission` overload is gone.
- **Scopes narrow, never widen.** A scope only ever restricts the issuer's existing ACL access:
  Global passes through, Contract intersects the handle's existing allowances, and Handles matches
  the listed ciphertexts. A scope cannot grant access the issuer did not already have.

## Stored ACPs are wiped

The store version bumped to 3 under a new key. Previously stored permits were signed with retired
EIP-712 types and cannot verify against the upgraded ACL, so they are dropped on load and
recreated on next use. **Users will be prompted to sign again.** Nothing to migrate — but warn the
developer, because it looks like data loss.

## Find them

```bash
grep -rnE 'Permit|\bpermits?\b' --include='*.ts' --include='*.tsx' . \
  | grep -vE 'permitted|permitting|Permitted|isPermittedCofheEnvironment|isAllowedWithPermission'
```

`Permit` is intentionally **not** `\b`-anchored: it appears mid-identifier
(`SerializedPermit`, `useCofheCreatePermit`, `getOrCreateSelfPermit`), and `\bPermit` matches none
of those. Lowercase `permit` _is_ anchored, so `permitted` / `permitting` stay out.

Then confirm each hit traces to a `@cofhe/*` import before rewriting.

## Do not rename

- English words: `permitted`, `permitting`, `permissible`
- `isPermittedCofheEnvironment` — a real, unchanged API
- `isAllowedWithPermission` — mirrors the on-chain interface; keeps its name (its parameter is
  now the `ACP` struct)
- The developer's own unrelated identifiers (`PermitModal`, `permitFormState`, …)
- Licence headers, changelogs, and historical migration notes
