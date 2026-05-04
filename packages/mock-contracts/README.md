# cofhe/mock-contracts [![NPM Package][npm-badge]][npm] [![License: MIT][license-badge]][license]

[npm]: https://www.npmjs.com/package/@fhenixprotocol/cofhe-mock-contracts
[npm-badge]: https://img.shields.io/npm/v/@fhenixprotocol/cofhe-mock-contracts.svg
[license]: https://opensource.org/licenses/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

A mock smart contract library for testing CoFHE (Confidential Computing Framework for Homomorphic Encryption) with FHE primitives. This package provides mock implementations of core CoFHE contracts for development and testing purposes.

## Features

- Mock implementations of core CoFHE contracts:
  - MockTaskManager
  - MockThresholdNetwork
  - MockZkVerifier
  - ACL (Access Control List)
- Synchronous operation simulation with mock delays
- On-chain access to unencrypted values for testing
- Compatible with the main `@fhenixprotocol/cofhe-contracts` package

## Installation

npm

```bash
npm install @fhenixprotocol/cofhe-mock-contracts
```

foundry

```bash
forge install fhenixprotocol/cofhe-mock-contracts
```

## Usages and Integrations

### Who is this for?

This package is intended for **developers building and testing CoFHE-enabled applications and smart contracts**.

Use these mocks when you want to:

- Run **local tests** without depending on the real CoFHE coprocessor infrastructure.
- Debug flows end-to-end (encrypt → submit → operate → decrypt) with fast iteration.
- Assert on results deterministically in CI.

Do **not** use these mocks for production deployments: they intentionally make testing convenient (e.g. storing plaintext on-chain for inspection) and therefore **do not provide real confidentiality guarantees**.

### Hardhat integration vs Foundry integration

Both integrations use the same underlying mock contracts, but they differ in **how mocks get deployed** and **how you interact with them**.

#### Hardhat (recommended for TS/SDK + Solidity tests)

Use this when you are already using **Hardhat** and/or want to run the **TypeScript SDK (`@cofhe/sdk`)** against a local chain.

- The `cofhesdk/hardhat-plugin` watches Hardhat `node` and `test` tasks.
- It automatically deploys the mocks to the Hardhat network at fixed addresses.
- The `cofheClient` (created with `createCofheClient(...)`) detects the mocks and routes CoFHE actions to them.

Minimal setup:

```ts
// hardhat.config.ts
import 'cofhe-hardhat-plugin';

export default {
  cofhe: {
    logMocks: true, // optional
  },
};
```

Run:

```bash
npx hardhat test
# or
npx hardhat node
```

If you want to assert on plaintext values in Hardhat tests, the plugin exposes helpers like `mock_expectPlaintext(...)` (see the hardhat-plugin README).

#### Foundry (recommended for Solidity-only tests)

Use this when you are writing tests in **Solidity** and running them with `forge test`.

- You typically inherit from the abstract `CoFheTest` helper to deploy/setup the necessary FHE mock environment.
- You use helper methods to create encrypted inputs and assert their underlying values.

> **Important**: You must set `isolate = true` in your `foundry.toml`. Without this setting, some variables may be used without proper permission checks, which will cause failures on production chains.

`@cofhe/sdk` is designed to work with mock contracts in a testing / hardhat environment. `cofhesdk/hardhat-plugin` deploys the mock contracts in this repo, and the `cofheClient` detects a testnet chain and interacts correctly using the mocks rather than the true CoFHE coprocessor.

When installed and imported in the `hardhat.config.ts`, `cofhesdk/hardhat-plugin` will watch for Hardhat `node` and `test` tasks, and will deploy the mocks to the hardhat testnet chain at fixed addresses.

Once deployed, interaction with the mock contracts is handled by the `cofheClient` (created with `createCofheClient(...)`). The client checks for the existence of mock contracts at known addresses, and if they exist, marks the current connection as a testnet.

## Logging

By default the mock CoFHE contracts log the internal "FHE" operations using `hardhat/console.sol`. Logs can be enabled or disabled using the `setLogOps()` function in `MockTaskManager.sol`.

## Differences between Cofhe and Mocks

### Symbolic Execution

The CoFHE coprocessor uses symbolic execution when performing operations on chain. Each ciphertext exists off-chain, and is represented by an on-chain ciphertext hash (`ctHash`).

FHE operations between one or more `ctHash`es returns a resultant `ctHash`, which is symbolically linked to the true `ciphertext` which includes the encrypted values.

In `cofhe-mock-contracts` the symbolic execution is preserved. In the case of the mocks, the `ciphertext` is not encrypted to be used in the FHE scheme, but is stored as a plaintext value. In this case, the `ctHash` associated with the `ciphertext` is pointing directly at the plaintext value instead.

During the execution of a mock FHE operation, say `FHE.add(euint8 ctHashA, euint8 ctHashB) -> euint8 ctHashC`, rather than being performed off-chain by the FHE computation engine, the input `ctHashes` are mapped to their plaintext value, and the operation performed as plaintext math on-chain. The result is inserted into the symbolic value position of `ctHashC`.

### Decryption for On-chain Use

For tx-oriented decryption, the consumer calls the Threshold Network decrypt endpoint and receives the plaintext together with a signature binding that plaintext to the `ctHash`. Contracts can then use that signature with `FHE.publishDecryptResult(...)` or `FHE.verifyDecryptResult(...)`.

When working with the mocks, the equivalent result is produced by the mock contracts. A random number between 1 and 10 is generated to simulate async delay, but the flow still resolves to the same kind of tx-ready decrypt result.

### ZkVerifying

A key component of CoFHE is the ability to pre-encrypt inputs in a secure and verifiable way. `cofhesdk` prepares these inputs automatically, and requests a verification signature from the coprocessor `ZkVerifier` module. The zkVerifier returns a signature indicating that the encrypted ciphertext is valid, and has been stored on the Fhenix L2 blockchain.

The mocks are then responsible for mocking two actions:

1. Creating the signature.
2. Storing the plaintext value on-chain.

The `MockZkVerifier` contract handles the on-chain storage of encrypted inputs. The signature creation is handled automatically within `cofheClient.encryptInputs` when executing against a testnet.

### Off-chain Decryption / Sealing

For view-oriented decryption, use the SDK flow `cofheClient.decryptForView(...)` (also exposed as `decryptHandle(...)`) with a valid `ctHash`, the matching FHE type, and a valid `permit` when required.

When interacting with CoFHE this request is routed to the Threshold Network, which returns the plaintext to the consumer for local use.

When working with the mocks, the `cofheClient` instead queries the `MockThresholdNetwork` contract, which verifies the request `permit` and returns the decrypted result.

### Using Foundry

Use abstract CoFheTest contract to automatically deploy all necessary FHE contracts for testing.

CoFheTest also exposes useful test methods such as

- `assertHashValue(euint, uint)` - asserting an encrypted value is equal to an expected plaintext value
- `createInEuint..(number, user)` - for creating encrypted inputs (8-256bits) for a given user

Example:

```solidity
import {Test} from "forge-std/Test.sol";
import {CoFheTest} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
...
contract TestBed is Test, CoFheTest {

  TestBed private testbed;

  address private user = makeAddr("user");

  function setUp() public {
    // optional ... enable verbose logging for fhe mocks
    // setLog(true);

    testbed = new TestBed();
  }

  function testSetValue() public {
    uint32 n = 10;
    InEuint32 memory number = createInEuint32(n, user);

    //must be the user who sends transaction
    //or else invalid permissions from fhe allow
    vm.prank(user);
    testbed.setValue(number);

    assertHashValue(testbed.getValue(), n);
  }
}
```

See `contracts/TestBed.sol` for the fixed-address wrapper used by the mocks.
