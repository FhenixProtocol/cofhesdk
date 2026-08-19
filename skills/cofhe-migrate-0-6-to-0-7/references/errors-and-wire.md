# Error codes and wire format

Only relevant if the project matches on `CofheErrorCode` values, inspects raw backend error
strings, or talks to the decryption backend directly.

## `CofheErrorCode` renames

| Before                   | After                 | String value             |
| ------------------------ | --------------------- | ------------------------ |
| `InvalidPermitData`      | `InvalidACPData`      | `INVALID_ACP_DATA`       |
| `InvalidPermitDomain`    | `InvalidACPDomain`    | `INVALID_ACP_DOMAIN`     |
| `PermitNotFound`         | `ACPNotFound`         | `ACP_NOT_FOUND`          |
| `CannotRemoveLastPermit` | `CannotRemoveLastACP` | `CANNOT_REMOVE_LAST_ACP` |
| `PermitMalformed`        | `ACPMalformed`        | `ACP_MALFORMED`          |
| `PermitDenied`           | `ACPDenied`           | `ACP_DENIED`             |
| `PermitExpired`          | `ACPExpired`          | `ACP_EXPIRED`            |
| `PermitInvalid`          | `ACPInvalid`          | `ACP_INVALID`            |
| `PermitRequired`         | `ACPRequired`         | `ACP_REQUIRED`           |
| `PermitVerifierError`    | `ACPVerifierError`    | `ACP_VERIFIER_ERROR`     |
| `PermitVerifierTimeout`  | `ACPVerifierTimeout`  | `ACP_VERIFIER_TIMEOUT`   |

The string values changed too, so anything comparing against `'PERMIT_DENIED'` and friends needs
updating — a string compare won't be caught by the compiler.

New: `ConsumingContractUninitialized` (`CONSUMING_CONTRACT_UNINITIALIZED`), thrown by
`execute()` when no consuming contract was set (JavaScript callers only — TypeScript catches it
at compile time).

New: `ACPRevoked` (`ACP_REVOKED`). **No backend produces it** — see below. It exists for callers
that determine revocation themselves, e.g. via `client.acp.isACPRevoked`.

## Backend wire codes

ACP-era backends emit `acp_*` where pre-upgrade ones emitted `permit_*`. Seven map 1:1:

| Wire code              | HTTP | `CofheErrorCode`     |
| ---------------------- | ---- | -------------------- |
| `acp_malformed`        | 400  | `ACPMalformed`       |
| `acp_denied`           | 401  | `ACPDenied`          |
| `acp_expired`          | 401  | `ACPExpired`         |
| `acp_invalid`          | 401  | `ACPInvalid`         |
| `acp_required`         | 400  | `ACPRequired`        |
| `acp_verifier_error`   | 502  | `ACPVerifierError`   |
| `acp_verifier_timeout` | 504  | `ACPVerifierTimeout` |

**Revocation folds into `acp_denied`.** ACP-era backends no longer distinguish revoked from
no-access from scope-miss — all three arrive as `acp_denied`. Code that branched on a distinct
revoked case must either treat denial uniformly or check revocation itself.

If you are on `0.6.1` exactly, these codes are new to you rather than renamed: the stable
threshold-network codes landed after that release, so a `0.6.1` app saw generic `DecryptFailed` /
`SealOutputFailed` instead. Handling for the specific codes above is new work, not a rename.

## Request body

The decryption request carries the ACP under the `acp` key (was `permit`). This matters if the
project **constructs, intercepts, rewrites, records, or asserts on** these requests — not just if
it originates them. Anything touching the wire shape counts.

The dangerous version is a `fetch` wrapper or fault injector that reads the SDK's own body through
a cast:

```ts
const body = JSON.parse(bodyStr) as { permit?: Record<string, unknown> };
if (!body.permit) return bodyStr; // now always true - the switcher silently no-ops
```

Zero compile errors, and the code path it was written to exercise stops being exercised. Grep for
`body.permit` and `'permit':` alongside the code renames.

## `CofheError.apiErrorCode`

`CofheError` now carries the raw backend `error` string alongside the mapped `code`, so you can
log or branch on codes the SDK doesn't model:

```ts
catch (e) {
  if (e instanceof CofheError) {
    e.code;          // CofheErrorCode.ACPDenied
    e.apiErrorCode;  // 'acp_denied'
  }
}
```

Related: a `404` from submit is now only retried while the backend reports `ct_not_found` (still
indexing). Any other code fails immediately instead of being retried until timeout.

## Find them

```bash
grep -rnE 'CofheErrorCode\.(Permit|InvalidPermit|CannotRemoveLastPermit)|PERMIT_[A-Z_]+|permit_(malformed|denied|expired|invalid|required|verifier)' \
  --include='*.ts' --include='*.tsx' .
```

## Verify

`tsc --noEmit` catches the enum members. It does **not** catch string comparisons against the old
`'PERMIT_*'` values — grep for those separately.
