# @cofhe/hardhat-3-plugin

A [Hardhat 3](https://hardhat.org) plugin for [CoFHE](https://docs.fhenix.io) development. It deploys the core CoFHE mock contracts to an in-process Hardhat network on every `network.connect()` call and exposes a `cofhe` namespace on the connection object — ready to use immediately, no boilerplate required.

## Features

- Automatically deploys the core CoFHE mock contracts (`MockTaskManager`, `MockACL`, `MockZkVerifier`, `MockThresholdNetwork`) on every `network.connect()`
- Exposes `conn.cofhe` on the Hardhat 3 connection object (compatible with `@nomicfoundation/hardhat-viem`'s `conn.viem`)
- Provides a batteries-included `cofhe.createClientWithBatteries()` for quick SDK client setup
- Mock-specific helpers: plaintext inspection, logging control, and Viem contract descriptors for every mock

---

## Installation

```bash
npm install @cofhe/hardhat-3-plugin
# or
pnpm add @cofhe/hardhat-3-plugin
```

---

## Configuration

Register the plugin in `hardhat.config.ts`:

```typescript
import { defineConfig } from 'hardhat/config';
import cofhePlugin from '@cofhe/hardhat-3-plugin';
import hardhatViem from '@nomicfoundation/hardhat-viem';
import hardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';

export default defineConfig({
  plugins: [cofhePlugin, hardhatViem, hardhatNodeTestRunner],

  // Optional cofhe config (all values shown are their defaults)
  cofhe: {
    gasWarning: true, // warn when mock ops report higher gas than real FHE
    logMocks: true, // enable mock contract event logging
  },
});
```

### Config options

| Option       | Type      | Default | Description                                                                              |
| ------------ | --------- | ------- | ---------------------------------------------------------------------------------------- |
| `gasWarning` | `boolean` | `true`  | Print a warning after mock deployment reminding that mock gas costs differ from live FHE |
| `logMocks`   | `boolean` | `true`  | Enable event-based logging inside mock contracts                                         |

---

## Usage

### The `cofhe` connection object

Every call to `network.connect()` automatically:

1. Deploys the core CoFHE mock contracts to the fresh in-process EVM
2. Attaches a `cofhe` namespace to the returned connection object

Because `network.connect()` is awaitable at the top level of an `async describe`, you can set everything up without lifecycle hooks:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

describe('My FHE contract', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  it('encrypts and decrypts a value', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    // ... test logic
  });
});
```

> **Why `async describe`?**  
> Hardhat 3's node:test runner supports top-level `await` inside the describe callback. This lets you resolve the connection (and deploy mocks) exactly once per test file without needing a `before()` hook.

---

## API reference

### `cofhe.createConfig(overrides?)`

Creates a CoFHE SDK configuration pre-wired for the Hardhat mock environment.

```typescript
const config = await cofhe.createConfig();
// With overrides:
const config = await cofhe.createConfig({ mocks: { encryptDelay: 0 } });
```

Returns a `CofheConfig` object suitable for `cofhe.createClient()`.

---

### `cofhe.createClient(config)`

Creates a `CofheClient` from a config. The client is **not connected** — call `client.connect(publicClient, walletClient)` before using it.

```typescript
const config = await cofhe.createConfig();
const client = cofhe.createClient(config);
await client.connect(publicClient, walletClient);
```

---

### `cofhe.createClientWithBatteries(walletClient?)`

Creates a fully initialized `CofheClient` in one call — configures it for Hardhat, connects it, and creates a self-permit so it can decrypt encrypted FHE variables out of the box.

```typescript
// Uses the first account in the connection automatically:
const client = await cofhe.createClientWithBatteries();

// Or pass a specific account-bound wallet client:
const [walletClient] = await viem.getWalletClients();
const client = await cofhe.createClientWithBatteries(walletClient);
```

---

### `cofhe.mocks`

#### Contract descriptors

The core mock contracts are exposed as an `{ address, abi }` object that can be spread directly into Viem's `readContract` / `writeContract`:

```typescript
// Core mock contracts are synchronous { address, abi } descriptors:
cofhe.mocks.MockTaskManager; // { address: `0x...`, abi: [...] }
cofhe.mocks.MockACL; // { address: `0x...`, abi: [...] }
cofhe.mocks.MockZkVerifier; // { address: `0x...`, abi: [...] }
cofhe.mocks.MockThresholdNetwork; // { address: `0x...`, abi: [...] }
```

`SimpleTest` is not injected onto `cofhe.mocks`. If a test needs it, deploy it explicitly and bind it locally using its fixed address and ABI.

Example — calling a mock directly with Viem:

```typescript
await walletClient.writeContract({
  ...cofhe.mocks.MockTaskManager,
  functionName: 'setSecurityZones',
  args: [0, 1],
});
```

#### Plaintext inspection

In the mock environment, every FHE ciphertext has a corresponding plaintext stored on-chain. These helpers let you inspect or assert on plaintext values without decryption:

```typescript
// Returns the plaintext bigint for a ciphertext hash
const plaintext = await cofhe.mocks.getPlaintext(ctHash);

// Throws if the plaintext doesn't match the expected value
await cofhe.mocks.expectPlaintext(ctHash, 42n);
```

Both methods accept a `ctHash` as either a `bigint` or a hex `string`.

#### Logging control

Mock contracts can emit structured logs for every FHE operation, which is useful for debugging. Logging is disabled by default.

```typescript
// Enable logging
await cofhe.mocks.enableLogs();

// Disable logging
await cofhe.mocks.disableLogs();

// Enable only for a specific block of code, then restore previous state
await cofhe.mocks.withLogs('my test', async () => {
  // ... FHE operations are logged here
});
```

#### `cofhe.mocks.deployMocks(options?)`

Re-deploys the core mock contracts. They are deployed automatically on every `network.connect()`.

```typescript
await cofhe.mocks.deployMocks({ gasWarning: false, mocksDeployVerbosity: '' });
```

| Option                 | Type                | Default         | Description                          |
| ---------------------- | ------------------- | --------------- | ------------------------------------ |
| `gasWarning`           | `boolean`           | inherits config | Print gas warning after deployment   |
| `mocksDeployVerbosity` | `'' \| 'v' \| 'vv'` | inherits config | Controls deployment output verbosity |

---

## Mock contracts

The plugin deploys these core contracts automatically on every `network.connect()`:

| Contract               | Address                                      | Description                                             |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `MockTaskManager`      | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` | Coordinates FHE operations and ACL                      |
| `MockACL`              | dynamic                                      | Access Control List — address resolved from TaskManager |
| `MockZkVerifier`       | `0x0000000000000000000000000000000000005001` | Verifies ZK proofs for encrypted inputs                 |
| `MockThresholdNetwork` | `0x0000000000000000000000000000000000005002` | Simulates the threshold decryption network              |

Fixed-address contracts are deployed via `hardhat_setCode`, ensuring they are always at the same address regardless of deployment order. `MockACL` is deployed as a normal contract (so its EIP-712 domain constructor runs correctly) and its address is registered in `MockTaskManager`.

If a test needs `SimpleTest`, deploy it directly from its artifact rather than through `cofhe.mocks`.

---

## Complete test example

```typescript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { Encryptable, FheTypes } from '@cofhe/sdk';

describe('Encrypted counter', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const simpleTestArtifact = /* your compiled SimpleTest artifact */;
  const deployHash = await walletClient.deployContract({
    abi: simpleTestArtifact.abi,
    bytecode: simpleTestArtifact.bytecode.object as `0x${string}`,
  });
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (!deployReceipt.contractAddress) throw new Error('SimpleTest deployment failed');

  const simpleTest = { address: deployReceipt.contractAddress, abi: simpleTestArtifact.abi } as const;

  it('encrypts, stores, and decrypts a uint32', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);

    // Encrypt
    const [enc] = await client.encryptInputs([Encryptable.uint32(42n)]).execute();

    // Store on-chain via SimpleTest
    await walletClient.writeContract({
      ...simpleTest,
      functionName: 'setValue',
      args: [enc],
    });

    const ctHash = (await publicClient.readContract({
      ...simpleTest,
      functionName: 'getValueHash',
    })) as `0x${string}`;

    // Decrypt via view (off-chain, instant)
    const decryptedView = await client.decryptForView(ctHash, FheTypes.Uint32).execute();
    assert.equal(decryptedView, 42n);

    // Alternatively, verify plaintext without decryption
    await cofhe.mocks.expectPlaintext(ctHash, 42n);
  });
});
```

---

## License

MIT
