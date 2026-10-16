---
'@cofhe/mock-contracts': patch
'@cofhe/sdk': patch
---

The mocks now behave like the real TaskManager and TFHE-rs in more places. Tests that relied on the old mock behaviour may start failing, as they would on a real network.

- `FHE.asE*` (trivial encrypt) reverts with `InvalidInputForFunction` when the value does not fit the type (e.g. `FHE.asEuint8(256)`), and with `InvalidSecurityZone` for an out of range zone, instead of storing the value masked.
- `encryptInputs` against the mocks rejects out-of-range values with the same error as the production path, instead of passing them on to be masked (e.g. `Encryptable.uint8(256n)` became `0`).
- `FHE.not` on encrypted integers is a bitwise NOT (`not(euint8(2))` is 253, not 0), and `FHE.rol` / `FHE.ror` rotate within the type's width, with the amount taken modulo the width, instead of shifting.
- `FHE.rem(x, 0)` returns `x` instead of reverting.
- `FHE.random*` handles carry their type and security zone and can be allowed and computed on.
- `MockTaskManager.isPubliclyAllowed` returns whether a handle was made public with `FHE.allowGlobal` / `FHE.allowPublic`, instead of reverting with `NotImplemented`.
- Handles in a negative security zone go through the ACL like any other handle. Previously any contract could use them and `FHE.allow*` did nothing.
- `publishDecryptResultBatch` emits `DecryptionResult` with the caller as `requestor`, and the batch decrypt result functions revert with `LengthMismatch` when the arrays differ in length.
- `setSecurityZones` rejects an inverted range (`min > max`) with `InvalidSecurityZone`.
