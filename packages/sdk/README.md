# @cofhe/sdk

Client SDK for the Fhenix CoFHE coprocessor: encrypt contract inputs, decrypt encrypted values, manage ACPs (the permissions that allow decryption).

Full documentation: [cofhesdk.fhenix.io](https://cofhesdk.fhenix.io). React apps: use [`@cofhe/react`](https://www.npmjs.com/package/@cofhe/react). Hardhat tests: use [`@cofhe/hardhat-plugin`](https://www.npmjs.com/package/@cofhe/hardhat-plugin), which creates a connected client for you.

```bash
npm install @cofhe/sdk viem
```

## Which entrypoint

The SDK loads a TFHE WASM module that differs between Node.js and the browser, so the client is created from the entrypoint of the runtime it runs in.

| Import from           | What                                                                       | Use in                           |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `@cofhe/sdk/node`     | `createCofheConfig`, `createCofheClient`                                   | Node.js, scripts, backends       |
| `@cofhe/sdk/web`      | `createCofheConfig`, `createCofheClient`                                   | Browser                          |
| `@cofhe/sdk`          | `Encryptable`, `FheTypes`, `CofheError`, `CofheErrorCode`, all types       | Anywhere (loads no WASM)         |
| `@cofhe/sdk/chains`   | `chains` (`sepolia`, `arbSepolia`, `baseSepolia`, `hardhat`, …)            | Anywhere                         |
| `@cofhe/sdk/adapters` | `Ethers6Adapter`, `Ethers5Adapter`, `WagmiAdapter`, `HardhatSignerAdapter` | When you don't have viem clients |
| `@cofhe/sdk/acps`     | `ACPUtils` and the ACP types                                               | Advanced ACP handling            |

Never import both `/node` and `/web` in one module. `createCofheClient` imported from `@cofhe/sdk` throws `WRONG_ENTRYPOINT`.

## Setup

```ts
import { createCofheConfig, createCofheClient } from '@cofhe/sdk/node'; // or '@cofhe/sdk/web'
import { chains } from '@cofhe/sdk/chains';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const client = createCofheClient(createCofheConfig({ supportedChains: [chains.sepolia] }));

const publicClient = createPublicClient({ chain: sepolia, transport: http() });
const walletClient = createWalletClient({
  account: privateKeyToAccount('0x…'), // required: the SDK signs and sends as this account
  chain: sepolia,
  transport: http(),
});

await client.connect(publicClient, walletClient);
```

With ethers: `const { publicClient, walletClient } = await Ethers6Adapter(provider, signer)` from `@cofhe/sdk/adapters`.

## Encrypt inputs and send them to a contract

```solidity
function setValue(externalEuint32[] memory inValues, bytes memory signature) external {
  storedValue = FHE.asEuint32s(inValues, signature)[0];
  FHE.allowThis(storedValue);
  FHE.allowSender(storedValue);
}
```

```ts
import { Encryptable } from '@cofhe/sdk';

// One hash per input, in order, then one signature for the whole batch.
const [value, signature] = await client.encryptInputs([Encryptable.uint32(42n)], {
  consumingContract: contractAddress, // the contract that calls FHE.asEuint*; the signature only works there
});

await walletClient.writeContract({
  address: contractAddress,
  abi,
  functionName: 'setValue',
  args: [[value], signature],
});
```

`Encryptable` has one factory per supported type: `bool`, `uint8`, `uint16`, `uint32`, `uint64`, `uint128`, `address`. Uint values are `bigint` or integer strings.

## Decrypt for display

The plaintext is returned to this client only. Requires an ACP; `getOrCreateSelfACP` asks the wallet for one signature and reuses the ACP until it expires.

```ts
await client.acp.getOrCreateSelfACP();

const handle = await publicClient.readContract({ address: contractAddress, abi, functionName: 'storedValue' });
const value = await client.decryptForView(handle, 'uint32', {}); // 42n
```

The type (`'uint32'`, or `FheTypes.Uint32`) must match the Solidity type of the handle (`euint32`). The result is a `bigint` for uints, a `boolean` for `bool`, a checksummed address `string` for `address`.

The contract must have granted the account access to the handle (`FHE.allowSender`, `FHE.allow`). Without it the call fails with `ACP_DENIED`.

## Decrypt to publish on chain

Returns the plaintext with a Threshold Network signature that a contract can verify.

```ts
const { ctHash, decryptedValue, signature } = await client.decryptForTx(handle, { acp: 'none' });
```

| `acp`           | Use when                                                 |
| --------------- | -------------------------------------------------------- |
| `'none'`        | The contract made the handle publicly decryptable        |
| `'active'`      | Access is restricted to the account; uses its active ACP |
| an `ACP` / hash | Decrypt with a specific ACP, e.g. one shared with you    |

## Two call forms

Each operation runs when given an options object and returns a builder without one. Both do the same thing.

```ts
await client.encryptInputs(inputs, { consumingContract });
await client.encryptInputs(inputs).setConsumingContract(consumingContract).execute();

await client.decryptForView(handle, 'uint32', {});
await client.decryptForView(handle, 'uint32').execute();

await client.decryptForTx(handle, { acp: 'none' });
await client.decryptForTx(handle).withoutACP().execute();
```

A builder that is not executed does nothing: `await client.decryptForView(handle, 'uint32')` resolves to the builder, not the value.

## Errors

SDK failures are `CofheError`s. Branch on `code` with `isCofheError`.

```ts
import { CofheErrorCode, isCofheError } from '@cofhe/sdk';

try {
  await client.decryptForView(handle, 'uint32', {});
} catch (error) {
  if (isCofheError(error, CofheErrorCode.ACPNotFound)) {
    await client.acp.getOrCreateSelfACP();
  }
  throw error;
}
```

| Field          | Content                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| `code`         | Stable identifier, see below                                                     |
| `shortMessage` | One sentence. Use this for text shown to a user                                  |
| `message`      | `shortMessage`, then the cause, the hint and the repair guide. Use this for logs |
| `hint`         | How to fix it, addressed to the developer                                        |
| `context`      | The values involved (plain data)                                                 |
| `cause`        | The underlying error, when there is one                                          |
| `repairGuide`  | Path of this code's section in the guide shipped with the package                |

Use `isCofheError(error)` rather than `error instanceof CofheError`: it also recognises an error from a second copy of the SDK in the same bundle.

| Code                               | Meaning                                                       | Fix                                                                                       |
| ---------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `WRONG_ENTRYPOINT`                 | `createCofheClient` imported from `@cofhe/sdk`                | Import from `@cofhe/sdk/node` or `@cofhe/sdk/web`                                         |
| `INVALID_CONFIG`                   | Unknown, renamed or malformed config key                      | See `message`; `context.issues` lists each key                                            |
| `NOT_CONNECTED`                    | No connection yet                                             | `await client.connect(publicClient, walletClient)`                                        |
| `WALLET_CLIENT_ACCOUNT_MISSING`    | Wallet client created without `account`                       | Pass `account` to `createWalletClient`                                                    |
| `UNSUPPORTED_CHAIN`                | The chain is not in the config's `supportedChains`            | Add the chain from `@cofhe/sdk/chains` to the config                                      |
| `CONSUMING_CONTRACT_UNINITIALIZED` | `encryptInputs` without a consuming contract                  | Pass `consumingContract`                                                                  |
| `INVALID_ARGUMENT`                 | A value the SDK cannot use, e.g. `300n` for a `uint8`         | See `hint`                                                                                |
| `ACP_NOT_FOUND`                    | No ACP for this account and chain                             | `await client.acp.getOrCreateSelfACP()`                                                   |
| `ACP_EXPIRED`                      | The ACP is past its expiration                                | `await client.acp.getOrCreateSelfACP()` creates a new one                                 |
| `ACP_DENIED`                       | No grant lets the ACP decrypt this handle (also: revoked ACP) | Grant access in the contract; right after the granting tx, set `accessDeniedRetryTimeout` |
| `NOT_PUBLICLY_ALLOWED`             | `acp: 'none'` on a handle that is not public                  | Use `acp: 'active'`                                                                       |
| `CT_NOT_FOUND`                     | The network has no ciphertext for the handle                  | Check the handle and the chain                                                            |

Every code has a section with its causes and fixes in [`skills/cofhe-errors/SKILL.md`](./skills/cofhe-errors/SKILL.md). The file ships in the package, and each error names its section: `error.repairGuide` is `node_modules/@cofhe/sdk/skills/cofhe-errors/SKILL.md#acp_not_found`. It is also an agent skill: copy or link the `cofhe-errors` folder into your agent's skills directory to have it loaded when a `CofheError` appears.

## Local development

On the `hardhat` chain the SDK talks to mock contracts instead of the CoFHE network; the API is the same. `@cofhe/hardhat-plugin` deploys the mocks and provides `hre.cofhe.createClientWithBatteries(signer)`, a connected client with a self ACP. See [Quick Start](https://cofhesdk.fhenix.io/quick-start).

## More

- [Client and connection](https://cofhesdk.fhenix.io/sdk/client)
- [Encrypting inputs](https://cofhesdk.fhenix.io/sdk/encrypting-inputs)
- [Decrypt for view](https://cofhesdk.fhenix.io/sdk/decrypt-to-view) / [for a transaction](https://cofhesdk.fhenix.io/sdk/decrypt-to-tx)
- [ACPs: create, share, revoke](https://cofhesdk.fhenix.io/sdk/acp)
