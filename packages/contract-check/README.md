# @cofhe/contract-check

Static checks for the CoFHE encrypted-type boundary conventions.

Encrypted values in CoFHE are **handles** — public `bytes32` identifiers pointing at ciphertext
the coprocessor holds. Anyone can copy a handle; what stops misuse is the ACL, which records who
may compute on it. A contract, however, is normally allowed on the handles it works with, so a
function that accepts a raw `euint64` from the outside world will happily compute on **someone
else's** handle using its own authority. That is the confused-deputy bug an audit found in a
confidential vault: an attacker replayed a victim's ciphertext hash and had the vault credit the
result to themselves.

The fix is a type turnstile. Live handles (`euint64`) never cross a trust boundary; instead
they travel as inert wrappers — `externalEuint64` + proof from users, `sharedEuint64` between
contracts — and the only way back to a usable handle is through `FHE.receive*`, which verifies
provenance. The type system enforces this **only if function signatures follow the convention**.
This package is what enforces the convention.

```
npx contract-check
```

---

## Rules

| id | severity | status |
|---|---|---|
| [`no-raw-encrypted-params`](#no-raw-encrypted-params) | error | implemented |
| [`no-raw-encrypted-returns`](#no-raw-encrypted-returns) | error | implemented |
| [`no-raw-shared-wrap`](#no-raw-shared-wrap) | error | implemented |
| [`external-input-missing-proof`](#external-input-missing-proof) | error | implemented |
| [`proof-placement`](#proof-placement) | warning | opt-in, off by default |
| [`receive-variant`](#receive-variant) | warning | implemented |

The encrypted types the rules recognise, mirroring the `type` declarations in
`cofhe-contracts/FHE.sol`:

- **live handles** — `ebool`, `euint8`, `euint16`, `euint32`, `euint64`, `euint128`, `eaddress`
- **user → contract** — `externalEbool`, `externalEuint8` … `externalEaddress` (carry a proof)
- **contract → contract** — `sharedEbool`, `sharedEuint8` … `sharedEaddress`

### `no-raw-encrypted-params`

External and public functions must not accept a live handle. Nested types are followed, so a
handle hidden inside a struct or an array is caught too.

```solidity
// flagged — no provenance: the caller may not own this handle
function confidentialDeposit(euint64 amount, address receiver) external;

// ok — inert wrapper, unwrapped through FHE.receiveEuint64Param
function confidentialDeposit(sharedEuint64 amount, address receiver) external;

// ok — user input with its proof
function confidentialDeposit(externalEuint64 amount, bytes calldata proof) external;

// ok — internal/private functions are the normal working surface for raw handles
function _doDeposit(euint64 amount) internal returns (euint64);
```

### `no-raw-encrypted-returns`

External and public **state-mutating** functions must not return a live handle; return
`FHE.shareEuintXX(value, receiver)` instead.

`view` and `pure` functions are exempt. The return data of a state-mutating call is invisible to
an EOA — only a calling contract can read it — so such a return is contract-consumed by
construction and needs the turnstile. A `view` getter, by contrast, serves off-chain readers who
decrypt through their own ACP, and a contract reading one still needs its own ACL grant.

```solidity
// flagged
function deposit(sharedEuint64 amount) external returns (euint64 shares);

// ok
function deposit(sharedEuint64 amount) external returns (sharedEuint64 shares);

// ok — view getter
function confidentialBalanceOf(address a) public view returns (euint64);
```

### `no-raw-shared-wrap`

`sharedEuintXX.wrap(...)` / `.unwrap(...)` may appear only inside the FHE library. These are
Solidity's raw conversions for user-defined value types: calling `unwrap` yourself produces a
usable handle **without** the `isAllowed` provenance check that lives inside `FHE.receive*`,
which is precisely the check the type exists to force.

```solidity
// flagged — walks around the turnstile
euint64 amount = euint64.wrap(sharedEuint64.unwrap(shared));

// ok — provenance verified against msg.sender
euint64 amount = FHE.receiveEuint64Param(shared);
```

### `external-input-missing-proof`

A function accepting `externalE*` inputs must also accept the proof bytes that verify them.

`externalEuint64` is inert — the only routes to a usable handle are `FHE.asEuint64(hash, proof)`
and the batch verifier, both of which need proof bytes. A signature with external inputs but no
`bytes` parameter cannot supply them, so the value can never be converted. That is wrong under
*every* arrangement, which is why this rule needs no convention.

```solidity
// flagged — nothing can verify this input
function deposit(externalEuint64 amount, address receiver) external;

// ok
function deposit(externalEuint64 amount, bytes calldata proof) external;
```

### `proof-placement`

**Opt-in; silent unless you configure it.** The library supports a proof per value
(`FHE.asEuintXX(hash, proof)`) *and* one signature covering a batch, so neither arrangement is a
defect and the checker accepts both by default.

Pin a style only when you want house consistency — usually so signatures match a generated client
encoder, since the SDK builds calldata in a fixed order:

```ts
await checkBuildInfoDir('artifacts/build-info', { proofStyle: 'trailing' });
```
```bash
npx contract-check --proof-style trailing
```

| setting | accepts |
|---|---|
| `any` *(default)* | both arrangements; rule reports nothing |
| `trailing` | exactly one proof, as the final parameter |
| `per-value` | each external input immediately followed by its own proof |

Deviations are reported as **warnings**, never errors — this is a style preference, not a
security property. Functions missing a proof entirely are left to
[`external-input-missing-proof`](#external-input-missing-proof) so one mistake is not reported
twice.

### `receive-variant`

The receive function must match where the shared value came from.

`FHE.receiveEuintXXParam(shared)` verifies provenance against `msg.sender` — correct for a handle
that arrived as a parameter. `FHE.receiveEuintXXFromCall(shared, callee)` verifies against a named
callee — correct for a handle another contract returned to you. Swapping them fails closed, but
with an opaque revert, so catching it statically is a usability win rather than a security one.
Hence **warning** severity.

```solidity
function consume(sharedEuint64 shared) external {
    // ok — arrived as a parameter, checked against msg.sender
    euint64 a = FHE.receiveEuint64Param(shared);

    // flagged — came back from a call, so the callee is the grantor
    euint64 b = FHE.receiveEuint64Param(token.pull());

    // ok
    euint64 c = FHE.receiveEuint64FromCall(token.pull(), address(token));
}
```

Origin is resolved **only where it is locally provable**: the argument is a call expression, a
reference to a parameter, or a local variable assigned exactly once. Reassigned locals, storage
reads, struct members and anything else yield "unknown" and the rule stays silent — it reports
what it can prove rather than guessing, which keeps it usable without a full data-flow pass.

---

## Usage

The checker reads **build-info**: the JSON that solc emits containing the fully resolved AST of
every source. Both Hardhat and Foundry produce it, so nothing here parses Solidity itself —
types arrive already resolved by the compiler, which is why `euint64` is unambiguous even
through imports and aliases.

### CLI

```bash
# Hardhat: writes artifacts/build-info/*.json
npx hardhat compile
npx contract-check

# Foundry: build-info is opt-in
forge build --build-info
npx contract-check out/build-info

# explicit path, single file or directory
npx contract-check path/to/build-info
```

Exit code is `1` when any error-severity finding is reported, `0` otherwise — so a bare
`npx contract-check` is already a usable CI gate.

### In a package script

```json
{
  "scripts": {
    "check:contracts": "hardhat compile && contract-check",
    "test": "pnpm check:contracts && hardhat test"
  }
}
```

### In CI

```yaml
- run: npx hardhat compile
- run: npx contract-check      # fails the job on any error finding
```

### Programmatic

```ts
import { checkBuildInfoDir, formatFindings } from '@cofhe/contract-check';

const findings = await checkBuildInfoDir('artifacts/build-info');
console.log(formatFindings(findings));

for (const f of findings) {
  // { rule, severity, file, line, message }
}
```

`checkBuildInfoFile(path)` and `checkBuildInfo(buildInfoObject)` are also exported for a single
file or an already-parsed object.

---

## Vendored and library code

Sources whose path matches `@fhenixprotocol/cofhe-contracts/` or `/FHE.sol` are exempt: the FHE
library defines the turnstile and necessarily uses `wrap`/`unwrap` internally. Override with the
`libraryPaths` option:

```ts
await checkBuildInfoDir('artifacts/build-info', {
  libraryPaths: ['@fhenixprotocol/cofhe-contracts/', '/FHE.sol', 'node_modules/'],
});
```

Note that build-info contains **every** compiled source, including dependencies. Running against
a token project today therefore reports findings in the confidential-token base contracts as
well as your own — some of those interfaces predate the convention. Until per-rule severity and
exclude globs land (see below), scope the run with `libraryPaths`, or read the report by file.

## Not implemented yet

- config file with `exclude` globs and per-rule severity (needed before this can be a hard gate
  in a repo with vendored contracts); `libraryPaths` and `proofStyle` are options today
- a Hardhat plugin that runs the check automatically after `compile`
- deeper origin analysis for [`receive-variant`](#receive-variant) — reassigned locals and values
  passed through helper functions are currently "unknown"; a Slither detector would close that gap
- callee matching: whether the address given to `receive*FromCall` is the contract actually called
