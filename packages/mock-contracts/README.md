# @fhenixprotocol/cofhe-mock-contracts [![NPM Package][npm-badge]][npm] [![License: MIT][license-badge]][license]

[npm]: https://www.npmjs.com/package/@fhenixprotocol/cofhe-mock-contracts
[npm-badge]: https://img.shields.io/npm/v/@fhenixprotocol/cofhe-mock-contracts.svg
[license]: https://opensource.org/licenses/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

A mock smart contract library for testing CoFHE (Confidential Computing Framework for Homomorphic Encryption) with FHE primitives. This package provides mock implementations of core CoFHE contracts for development and testing purposes.

## Features

- Mock implementations of core CoFHE contracts:
  - MockTaskManager
  - MockQueryDecrypter
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

Both `cofhejs` and `cofhe-hardhat-plugin` interact directly with the cofhe-mock-contracts.

When installed and imported in the `hardhat.config.ts`, `cofhe-hardhat-plugin` will watch for Hardhat `node` and `test` tasks, and will inject the necessary mock contracts into the hardhat testnet chain at fixed addresses.

Once deployed, interaction with the mock contracts is handled by `cofhejs`. `cofhejs` checks for the existence of mock contracts at known addresses, and if they exist, marks the current connection as a testnet. On testnet chains, `cofhejs` will exit from the default flow when `cofhejs.encrypt` or `cofhejs.unseal` are used.

## Logging

By default the mock CoFHE contracts log the internal "FHE" operations using `hardhat/console.sol`. Logs can be enabled or disabled using the `setLogOps()` function in `MockTaskManager.sol`.

## Differences between Cofhe and Mocks

### Symbolic Execution

The CoFHE coprocessor uses symbolic execution when performing operations on chain. Each ciphertext exists off-chain, and is represented by an on-chain ciphertext hash (`ctHash`).

FHE operations between one or more `ctHash`es returns a resultant `ctHash`, which is symbolically linked to the true `ciphertext` which includes the encrypted values.

In `cofhe-mock-contracts` the symbolic execution is preserved. In the case of the mocks, the `ciphertext` is not encrypted to be used in the FHE scheme, but is stored as a plaintext value. In this case, the `ctHash` associated with the `ciphertext` is pointing directly at the plaintext value instead.

During the execution of a mock FHE operation, say `FHE.add(euint8 ctHashA, euint8 ctHashB) -> euint8 ctHashC`, rather than being performed off-chain by the FHE computation engine, the input `ctHashes` are mapped to their plaintext value, and the operation performed as plaintext math on-chain. The result is inserted into the symbolic value position of `ctHashC`.

### On-chain Decryption

CoFHE coprocessor handles on-chain decryption requests asynchronously. Once the decryption is requested with `FHE.decrypt(...)` the decryption will be performed off-chain by CoFHE, and the result posted on-chain in the `PlaintextStorage` module of `TaskManager`. The decryption result can then checked using either `FHE.getDecryptResult(...)` or `FHE.getDecryptResultSafe(...)`.

When a mock decryption is requested, a random number between 1 and 10 is generated to determine how many seconds the mock decryption async duration. Though the decryption result is available immediately within the mock contracts, the async duration is added to mimic the off-chain decryption and posting time.

### ZkVerifying

A key component of CoFHE is the ability to pre-encrypt inputs in a secure and verifiable way. `cofhejs` prepares these inputs automatically, and requests a verification signature from the coprocessor `ZkVerifier` module. The zkVerifier returns a signature indicating that the encrypted ciphertext is valid, and has been stored on the Fhenix L2 blockchain.

The mocks are then responsible for mocking two actions:

1. Creating the signature.
2. Storing the plaintext value on-chain.

The `MockZkVerifier` contract handles the on-chain storage of encrypted inputs. The signature creation is handled in `cofhejs` when executing against a testnet.

### Off-chain Decryption / Sealing

Off-chain decryption is performed by calling the `cofhejs.unseal` function with a valid `ctHash` and a valid `permit` [todo link].

When interacting with CoFHE this request is routed to the Threshold Network, which will perform the decryption operation, ultimately returning a decrypted result.

When working with the mocks, `cofhejs` will instead query the `MockQueryDecrypter` contract, which will verify the request `permit`, and return the decrypted result.

### Using Foundry

> **Important**: You must set `isolate = true` in your `foundry.toml`. Without this setting, some variables may be used without proper permission checks, which will cause failures on production chains.

Use abstract CoFheTest contract to automatically deploy all necessary FHE contracts for testing.

CoFheTest also exposes useful test methods such as

- `assertHashValue(euint, uint)` - asserting an encrypted value is equal to an expected plaintext value
- `createInEuint..(number, user)` - for creating encrypted inputs (8-256bits) for a given user

see `contracts/TestBed.sol` for the original contract

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

  function testSetNumber() public {
    uint32 n = 10;
    InEuint32 memory number = createInEuint32(n, user);

    //must be the user who sends transaction
    //or else invalid permissions from fhe allow
    vm.prank(user);
    testbed.setNumber(number);

    assertHashValue(testbed.eNumber(), n);
  }
}
```
