---
'@cofhe/hardhat-plugin': patch
---

fix(hardhat-plugin): correctly detect non-mock networks in mock_getPlaintext/mock_getPlaintextExists/mock_expectPlaintext

`mock_checkIsTestnet` decided whether to skip these test helpers by checking `bytecode.length === 0` on the result of `provider.getCode(MOCKS_ZK_VERIFIER_ADDRESS)`. `getCode` (and the underlying `eth_getCode` RPC method) returns the string `"0x"`, never a zero-length string, when no contract is deployed at an address, so this check never evaluated to `true`. As a result, running a test suite that uses these helpers against a real network (rather than the local Hardhat mock network) never hit the intended "skipped on non-testnet chain" no-op path, and instead attempted a live call to `mockStorage`/`inMockStorage` on the real `TaskManager`, surfacing as an opaque low-level call failure instead of a clean skip.

The check now mirrors the already-correct `isMockEnvironment` logic in `@cofhe/hardhat-3-plugin` (`!bytecode || bytecode.length <= 2`). Added unit test coverage (`packages/hardhat-plugin/test/mockPlaintextHelpers.test.ts`) for both branches.
