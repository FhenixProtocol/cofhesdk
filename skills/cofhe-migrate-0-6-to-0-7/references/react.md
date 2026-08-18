# @cofhe/react

Read [acp-rename.md](acp-rename.md) and [config.md](config.md) first — the hook renames follow the same Permit→ACP rule, and
four of the five renamed config keys live under `react`.

## Hooks

| Before                           | After                         |
| -------------------------------- | ----------------------------- |
| `useCofhePermits`                | `useCofheACPs`                |
| `useCofheActivePermit`           | `useCofheActiveACP`           |
| `useCofheAllPermits`             | `useCofheAllACPs`             |
| `useCofheRemovePermit`           | `useCofheRemoveACP`           |
| `useCofheSelectPermit`           | `useCofheSelectACP`           |
| `useCofheCreatePermit`           | `useCofheCreateACP`           |
| `useCofheNavigateToCreatePermit` | `useCofheNavigateToCreateACP` |
| `useWatchPermitStatus`           | `useWatchACPStatus`           |
| type `PermitState`               | `ACPState`                    |

## Components

`PermitCard`→`ACPCard`, `PermitItem`→`ACPItem`, `PermitInfoModal`→`ACPInfoModal`,
`PermitDetailsModal`→`ACPDetailsModal`, `PermitTypeInfoModal`→`ACPTypeInfoModal`. The
floating-button page tree moved from `pages/permits/**` to `pages/acps/**`.

## Hook options and returned fields

Easy to miss: these are **fields on objects**, not imported names, so they don't show up when you
grep for imports — but destructuring one that no longer exists silently yields `undefined`.

| Before                            | After                          | Where                                                                                      |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `requiresPermit`                  | `requiresACP`                  | option to `useCofheReadContract`, `useCofheReadContracts`, `useCofheTokenDecryptedBalance` |
| `disabledDueToMissingValidPermit` | `disabledDueToMissingValidACP` | returned by the same hooks                                                                 |
| `hasActivePermit`                 | `hasActiveACP`                 | returned                                                                                   |
| `activePermitHash`                | `activeACPHash`                | returned / option                                                                          |

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

## Find them

```bash
grep -rnE 'useCofhe(Permits|ActivePermit|AllPermits|RemovePermit|SelectPermit|CreatePermit|NavigateToCreatePermit)|useWatchPermitStatus|PermitState|Permit(Card|Item|InfoModal|DetailsModal|TypeInfoModal)' \
  --include='*.ts' --include='*.tsx' .

# bare-array useCofheEncrypt calls
grep -rnE 'encrypt(InputsAsync)?\(\s*\[' --include='*.ts' --include='*.tsx' .
```

## Verify

`tsc --noEmit`, then exercise an encrypt-and-write path in the running app. The ACP store is wiped
by this release, so expect a signature prompt on first use — that is expected, not a bug.
