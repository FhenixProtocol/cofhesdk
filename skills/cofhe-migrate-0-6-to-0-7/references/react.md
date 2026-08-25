# @cofhe/react

Read [acp-rename.md](acp-rename.md) and [config.md](config.md) first — the hook renames follow the same Permit→ACP rule, and
four of the five renamed config keys live under `react`.

## Hooks

Exported from the package barrel — a project can import these, so a rename here is a real
compile error:

| Before                           | After                         |
| -------------------------------- | ----------------------------- |
| `useCofheActivePermit`           | `useCofheActiveACP`           |
| `useCofheAllPermits`             | `useCofheAllACPs`             |
| `useCofheRemovePermit`           | `useCofheRemoveACP`           |
| `useCofheSelectPermit`           | `useCofheSelectACP`           |
| `useCofheCreatePermit`           | `useCofheCreateACP`           |
| `useCofheNavigateToCreatePermit` | `useCofheNavigateToCreateACP` |
| type `PermitState`               | `ACPState`                    |

## Not importable — do not go hunting for these

`@cofhe/react`'s barrel is fully explicit (no `export *`), and these were **never** exported. They
renamed internally, but no consumer can be importing them, so there is nothing to migrate:

`useCofhePermits`, `useWatchPermitStatus`, `PermitCard`, `PermitItem`, `PermitInfoModal`,
`PermitDetailsModal`, `PermitTypeInfoModal`, and the floating-button page tree
(`pages/permits/**` → `pages/acps/**`).

If a project references one of these it reached past the barrel into `src/`, which the rename
tables here do not cover — flag it rather than guessing.

## Renamed members inside exported const maps

A category no barrel diff can see: the **container name never changes**, only its members. `tsc`
catches member access, but nothing catches code comparing the _string values_, which moved in
lockstep.

Exported, so a project can be reading these:

| Container                  | Renamed members                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `COFHE_STATUS_IDS`         | `missingPermit`→`missingACP`, `permitExpired`→`acpExpired`, `permitExpiringSoon`→`acpExpiringSoon`, `permitShared`→`acpShared` |
| `CofheStatusActionIntents` | `openPermits`→`openACPs`                                                                                                       |
| `SignatureTypes`           | `PermissionedV2IssuerSelf`→`ACPIssuerSelf`, `…IssuerShared`→`ACPIssuerShared`, `…Recipient`→`ACPRecipient` (from `@cofhe/sdk`) |

Internal — renamed, but not importable, so nothing to migrate: `FloatingButtonPage`
(`Permits`→`ACPs`, `GeneratePermits`→`GenerateACPs`, `DelegatePermits`→`DelegateACPs`,
`ReceivePermits`→`ReceiveACPs`) and `PortalModal` (`PermitDetails`→`ACPDetails`,
`PermitInfo`→`ACPInfo`, `PermitTypeInfo`→`ACPTypeInfo`).

The values changed too: `'missing-permit'`→`'missing-acp'`, `'permit-expired'`→`'acp-expired'`,
`'open-permits'`→`'open-acps'`. A codebase that persisted a status id, keyed a dismissal by it, or
sent it in telemetry breaks **silently**:

```bash
grep -rnE "'(open-permits|missing-permit|permit-expired|permit-expiring-soon|permit-shared)'" \
  --include='*.ts' --include='*.tsx' .
```

## Hook options and returned fields

Easy to miss: these are **fields on objects**, not imported names, so they don't show up when you
grep for imports — but destructuring one that no longer exists silently yields `undefined`.

| Before                                         | After                                            | Where                                                                                          |
| ---------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `requiresPermit`                               | `requiresACP`                                    | option to `useCofheReadContractAndDecrypt`, `useCofheTokenDecryptedBalance`, `useCofheEnabled` |
| `disabledDueToMissingValidPermit`              | `disabledDueToMissingValidACP`                   | returned by the same hooks                                                                     |
| `hasActivePermit`                              | `hasActiveACP`                                   | returned                                                                                       |
| `useCofheActivePermit()` → `{ permit }`        | `useCofheActiveACP()` → `{ acp, isValid, hash }` | the return shape gained two fields as well as renaming one                                     |
| `useCofheDecryptionActivity()` → `permit: {…}` | → `acp: {…}`                                     | same shape, field renamed only                                                                 |
| `activePermitHash`                             | `activeACPHash`                                  | returned / option                                                                              |

```tsx
// BEFORE
const { data, disabledDueToMissingValidPermit } = useCofheReadContract({
  address,
  abi,
  functionName: 'balanceOf',
  requiresPermit: true,
});

// AFTER
const { data, disabledDueToMissingValidACP } = useCofheReadContract({
  address,
  abi,
  functionName: 'balanceOf',
  requiresACP: true,
});
```

`requiresPermit: true` passed to a hook that now expects `requiresACP` means the gate never
engages — the read fires without an ACP instead of waiting for one. Worth grepping for
explicitly.

## `useCofheEncrypt` — required consuming contract, no more bare array

The bare-array call form is **removed**: without a consuming contract it cannot produce a usable
result, so it is now a type error rather than a runtime one.

```tsx
// BEFORE
const { encryptInputsAsync: encrypt } = useCofheEncrypt();
const result = await encrypt([Encryptable.uint32(5n)]);

// AFTER
const { encryptInputsAsync: encrypt } = useCofheEncrypt();
const result = await encrypt({
  items: [Encryptable.uint32(5n)],
  consumingContract: contractAddress,
});
```

The return type changed with it — `readonly EncryptedItemInput[]` is now
``readonly `0x${string}`[]`` holding `[...hashes, signature]`. See [encrypt-inputs.md](encrypt-inputs.md).

## `useCofheEncryptAndWriteContract` — unchanged

It defaults `consumingContract` to the write's target address, since that is already known. No
change needed at call sites. An explicit `encryptionOptions.consumingContract` still wins.

```tsx
// works exactly as before
const { encryptAndWrite } = useCofheEncryptAndWriteContract();
await encryptAndWrite({
  params: { address: contractAddress, abi, functionName: 'setValue' },
  args: [Encryptable.uint32(5n)],
});
```

## `CofheEncryptInput` — new required prop

```tsx
// BEFORE
<CofheEncryptInput onEncryptComplete={handle} />
// AFTER
<CofheEncryptInput consumingContract={contractAddress} onEncryptComplete={handle} />
```

Without it the component could not produce a usable value, so the prop is required rather than
optional.

## Behaviour changes worth knowing

These landed alongside the rename and change runtime behaviour without any compile error:

- **`useCofheToken` no longer probes on-chain.** It resolves against what the client already knows
  — configured token lists, imported tokens, the chain's default token — and returns `undefined`
  for anything else. Its options parameter is deprecated and unused. If you relied on the
  on-chain interface probe for unlisted addresses, call `useResolvedCofheToken` explicitly. The
  new `useKnownCofheToken({ chainId, address })` is the non-probing resolver.
- **Only successful queries are persisted.** Previously an errored query could be dehydrated and
  restored in its failed state, which never refetched — leaving a permanent error across reloads.
  Errored entries are now dropped from the snapshot.
- **Creating a sharing ACP no longer activates it.** `createSharing` is store-only by default; a
  delegated ACP no longer hijacks the issuer's own active ACP. `getOrCreateSharingACP` opts in via
  `activate: true`.

## Unshield-claim hooks — a shape change, not a rename

Only for apps using confidential tokens. The hook names are unchanged, so nothing here shows up as a
missing identifier; read [confidential-tokens.md](confidential-tokens.md) §7 for the contract-side
reasons.

- **`useCofheTokenClaimable` no longer has a plaintext amount to read.** The claim struct's
  `requestedAmount` is gone, so the hook decrypts each pending claim under the holder's ACP to
  produce `claimableAmount`, and reports **`undecryptedCount`** for the ones it could not read.
  Undecryptable claims stay in the list on purpose. A UI that assumed an always-available figure
  needs an "amount unknown" state, and `undecryptedCount > 0` is the signal for it — most often a
  missing or expired ACP rather than an error.
- **`claimableCount` is the readiness signal, not `decryptedAmount`.** `getUserClaims` returns only
  unclaimed claims, and every one carries `decryptedAmount == 0`. Any app-side
  `decryptedAmount > 0n` test is dead logic that reports "pending" forever.
- **A hand-rolled claim submission must submit `claim.id` and decrypt `claim.ctHash`.** Two
  different `Hex` values, both required. `useCofheTokenClaimUnshielded` /
  `getCofheTokenClaimUnshieldedCallArgs` already do this; anything bypassing them needs checking,
  because the selector is unchanged and a swap fails only on chain.
- **Any locally declared claim-struct ABI must be updated** to `(bytes32 id, address to, bytes32
ctHash, uint64 decryptedAmount, bool claimed)`. Both shapes are five static slots, so an old
  declaration decodes without complaint and yields misaligned nonsense.

## Find them

```bash
grep -rnE 'useCofhe(ActivePermit|AllPermits|RemovePermit|SelectPermit|CreatePermit|NavigateToCreatePermit)|PermitState' \
  --include='*.ts' --include='*.tsx' .

# bare-array useCofheEncrypt calls
grep -rnE 'encrypt(InputsAsync)?\(\s*\[' --include='*.ts' --include='*.tsx' .

# claim surface - none of these are compiler-caught
grep -rnE 'requestedAmount|decryptedAmount\s*[>!=]|claimUnshielded|getUserClaims' \
  --include='*.ts' --include='*.tsx' .
```

## Verify

`tsc --noEmit`, then exercise an encrypt-and-write path in the running app. The ACP store is wiped
by this release, so expect a signature prompt on first use — that is expected, not a bug.
