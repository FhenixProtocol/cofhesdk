# Config keys

Five config keys were renamed. **In 0.6.x these were silently discarded** — the schema stripped
unknown keys, so the replacement quietly fell back to its default. In 0.7.0 both schemas reject
unknown keys and name the replacement, so a stale key now throws at client construction:

```
Invalid cofhe configuration: `defaultPermitExpiration` is now `defaultACPExpiration`.
See the v0.7.0 migration guide.
```

## Renames

| Before                                 | After                               | Default it silently fell back to in 0.6.x |
| -------------------------------------- | ----------------------------------- | ----------------------------------------- |
| `defaultPermitExpiration`              | `defaultACPExpiration`              | 30 days                                   |
| `react.shareablePermits`               | `react.shareableACPs`               | `false`                                   |
| `react.autogeneratePermits`            | `react.autogenerateACPs`            | `true`                                    |
| `react.permitExpirationOptions`        | `react.acpExpirationOptions`        | built-in option list                      |
| `react.defaultPermitExpirationSeconds` | `react.defaultACPExpirationSeconds` | 1 week                                    |

```ts
// BEFORE
createCofheConfig({
  supportedChains: [chains.arbSepolia],
  defaultPermitExpiration: 60 * 60 * 24,
  react: { autogeneratePermits: false, defaultPermitExpirationSeconds: 3600 },
});

// AFTER
createCofheConfig({
  supportedChains: [chains.arbSepolia],
  defaultACPExpiration: 60 * 60 * 24,
  react: { autogenerateACPs: false, defaultACPExpirationSeconds: 3600 },
});
```

> Worth telling the developer: if their 0.6.x app set any of these **after** the rename landed
> upstream, the setting was already being ignored. Behaviour may change once it starts applying
> again — an expiration they thought was 1 day may have been running at 30.

## Unknown keys are now rejected

Both schemas are strict. Any key that isn't recognised — a typo, a leftover from an older
version, a speculative option — throws instead of being dropped. If the developer was passing
extra keys deliberately, they must remove them.

## New `acp` block (additive, optional)

```ts
createCofheConfig({
  supportedChains: [...],
  acp: {
    defaultRevoker?: Record<number, `0x${string}`>,        // per chainId; defaults to the ACL's
    defaultContractScopes?: Record<number, `0x${string}`[]>,
    sharingRegistry?: Record<number, `0x${string}`>,       // per chainId; defaults to the ACL's
  },
});
```

All three are overrides — when unset, the address served by the chain's ACL is used. Note that
setting `defaultContractScopes` makes newly created ACPs **non-global by default**, which narrows
what they can decrypt. Don't add it unless the developer asks.

## Find them

```bash
grep -rnE 'defaultPermitExpiration|shareablePermits|autogeneratePermits|permitExpirationOptions|defaultPermitExpirationSeconds' \
  --include='*.ts' --include='*.tsx' .
```

## Verify

Construct the client. A stale or unknown key throws immediately with the replacement named, so
booting the app once is the check. Grep as well — config is often built in a file that no test
exercises.
