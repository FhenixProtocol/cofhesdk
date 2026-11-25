---
name: cofhe-errors
description: >-
  Diagnoses and fixes a CofheError thrown by @cofhe/sdk or @cofhe/react. Use when output contains
  "CofheError", a "Guide: node_modules/@cofhe/sdk/skills/cofhe-errors/SKILL.md#..." reference, or
  one of the SDK error codes, for example ACP_NOT_FOUND, ACP_DENIED, ACP_EXPIRED,
  NOT_PUBLICLY_ALLOWED, CT_NOT_FOUND, NOT_CONNECTED, WALLET_CLIENT_ACCOUNT_MISSING,
  INVALID_CONFIG, INVALID_ARGUMENT, UNSUPPORTED_CHAIN,
  CONSUMING_CONTRACT_UNINITIALIZED, ZK_PACK_FAILED, ZK_VERIFY_FAILED, INIT_TFHE_FAILED,
  FETCH_KEYS_FAILED, DECRYPT_FAILED, SEAL_OUTPUT_FAILED or TASK_MANAGER_UNRESOLVED.
license: MIT
---

# Fixing a CofheError

This file ships inside `@cofhe/sdk`, so it matches the installed version. Every `CofheError` names its section here in `error.repairGuide` and at the end of `error.message`.

## Read the error first

| Field          | Use                                                                                |
| -------------- | ---------------------------------------------------------------------------------- |
| `code`         | Find the section below with the same name                                          |
| `hint`         | The fix for this exact throw site. Apply it before reading further                 |
| `context`      | The values involved: `chainId`, `account`, `supportedChainIds`, `issues`, …        |
| `cause`        | The underlying error (an RPC failure, a failed fetch)                              |
| `httpStatus`   | Set when a CoFHE service answered with an error status. Unset: no response arrived |
| `apiErrorCode` | The raw error string of the Threshold Network, when the error came from it         |

`console.log(error.toString())` prints all of them. In a `catch`, test with `isCofheError(error, CofheErrorCode.X)` from `@cofhe/sdk`.

Sections are grouped by where the error appears: [setup](#setup-and-config), [connection](#connection), [encrypting](#encrypting-inputs), [decrypting](#decrypting), [local mocks](#local-mocks), [not thrown](#codes-this-version-does-not-throw).

## Setup and config

### INVALID_CONFIG

`createCofheConfig` rejected the config. Unknown keys are errors, not ignored. The message lists each rejected key; `context.issues` has them as data.

- A key renamed in a newer version: `context.renamedKeys` maps old to new (`defaultPermitExpiration` is now `defaultACPExpiration`).
- A typo, or a key that belongs in a nested object (`acp`, `mocks`, and `react` in `@cofhe/react`).
- The only required key is `supportedChains`.

### UNSUPPORTED_CHAIN

The chain id is not in the config's `supportedChains`. `context.chainId` is the chain asked for, `context.supportedChainIds` the ones configured.

```ts
import { chains } from '@cofhe/sdk/chains';
createCofheConfig({ supportedChains: [chains.sepolia, chains.arbSepolia] });
```

If the chain id is unexpected, the wallet is on a different network than the app assumes.

### MISSING_CONFIG

Something the operation needs is not configured. The message says which:

- **`CoFHE URL is not configured for chain`**: a hand-written chain object lacks `coFheUrl`. Use the chain from `@cofhe/sdk/chains`.
- **`No ACP share registry available for chainId`**: on-chain sharing was used on a chain whose ACL serves no registry. Set `acp.sharingRegistry: { [chainId]: address }` in the config.
- **`Builder config is undefined`**: a builder was constructed by hand. Get builders from the client (`client.encryptInputs(...)`).

### ZK_VERIFIER_URL_UNINITIALIZED

The chain object has no `verifierUrl`, which `encryptInputs` needs. Use the chain from `@cofhe/sdk/chains` instead of a hand-written one.

### THRESHOLD_NETWORK_URL_UNINITIALIZED

The chain object has no `thresholdNetworkUrl`, which decryption needs. Use the chain from `@cofhe/sdk/chains` instead of a hand-written one.

### TASK_MANAGER_UNRESOLVED

The SDK could not find the CoFHE contracts on this chain.

- A public chain: CoFHE is not deployed there. Use a chain listed in `@cofhe/sdk/chains`.
- A local Hardhat or Anvil chain: the mocks are not deployed. `@cofhe/hardhat-plugin` deploys them automatically unless `COFHE_SKIP_MOCKS_DEPLOY=1` is set.
- The RPC call itself failed: see `cause`.

## Connection

### NOT_CONNECTED

An operation ran before `client.connect` finished.

```ts
await client.connect(publicClient, walletClient); // await it
```

- In React, pass `publicClient` and `walletClient` to `CofheProvider` and gate the call on `useCofheConnection().connected`.
- `client.disconnect()` ends the connection. `@cofhe/react` also disconnects when the wallet has no clients or moves to a chain outside `supportedChains`.
- The ACP readers (`client.acp.getACPs()` etc.) work while disconnected only when given `chainId` and `account` explicitly.

### WALLET_CLIENT_ACCOUNT_MISSING

The wallet client passed to `connect` has no `account`. The SDK signs ACPs and sends transactions as that account.

```ts
createWalletClient({ account, chain, transport }); // account: an address, or privateKeyToAccount('0x…')
```

wagmi's wallet client and the adapters in `@cofhe/sdk/adapters` already set it.

### PUBLIC_WALLET_GET_CHAIN_ID_FAILED

`connect` asked the public client for the chain id and the call failed or returned nothing. The RPC is unreachable or the transport URL is wrong; `cause` has the RPC error.

### ACCOUNT_UNINITIALIZED

A builder has no account. Connect first, or name one with `.setAccount(address)`.

### CHAIN_ID_UNINITIALIZED

A builder has no chain id. Connect first, or name one with `.setChainId(id)`.

### MISSING_PUBLIC_CLIENT

A builder needed the public client and there is none. Call `await client.connect(publicClient, walletClient)` before creating the builder.

### MISSING_WALLET_CLIENT

A builder needed the wallet client and there is none. Call `await client.connect(publicClient, walletClient)` before creating the builder.

## Encrypting inputs

### CONSUMING_CONTRACT_UNINITIALIZED

`encryptInputs` was not told which contract will consume the result. It is required: the signature is bound to that contract.

```ts
await client.encryptInputs(inputs).setConsumingContract(contractAddress).execute();
```

It is the contract that calls `FHE.asEuint*` on the values, which is not always the contract the transaction is sent to. In `@cofhe/react`, `useCofheEncrypt` takes `consumingContract` in its variables and `useCofheEncryptAndWriteContract` defaults it to the written contract.

### CONSUMING_CONTRACT_INVALID

The consuming contract is not a 20-byte address. Pass the deployed address as a `0x…` string of 40 hex digits, not a contract object, an ENS name or `undefined`.

### INVALID_ARGUMENT

A value the SDK cannot use. The message and `hint` say which; the usual cases:

- **`Value out of range`**: the value does not fit the type, e.g. `Encryptable.uint8(300n)`. Use a wider type, and make the Solidity parameter match (`externalEuint16`).
- **`Unable to convert to bigint`**: an empty string, a decimal such as `"1.5"`, or a non-numeric string. Uints take a `bigint` or an integer string; scale decimals first (`parseUnits`).
- **`Bool encryptable data must be boolean`** / **`Uint encryptable data must be string or bigint`**: the value type does not match the `Encryptable` type.
- **`Unsupported encryptable type`**: supported names are `bool`, `uint8`, `uint16`, `uint32`, `uint64`, `uint128`, `address`.
- **`missing acp selection`**: say who may decrypt before `.execute()`: `.withoutACP()` for a publicly decryptable handle, `.withACP()` for the active ACP, `.withACP(acp)` for a specific one.
- **`can only be selected once`** / **`cannot call … after …`**: a `decryptForTx` builder had its ACP mode chosen twice. Start a new `client.decryptForTx(...)`.
- **`setAccessDeniedRetryTimeout(timeoutMs) expects …`**: pass milliseconds, 0 or more.

### ZK_PACK_FAILED

The inputs could not be packed into one batch.

- **`No items to encrypt`**: the input array is empty.
- **`Total bits … exceeds 2048`**: the batch is too large. The limit is 2048 bits per call (a `uint128` is 128, an `address` 160). Split the inputs over several `encryptInputs` calls.
- **`Inputs name different security zones`** / **`but setSecurityZone(…) was called`**: one call encrypts for one security zone. Give every input the same zone, or use one call per zone.
- **`Invalid utype`**: an input was not made with `Encryptable`. Build inputs with `Encryptable.uint64(value)` etc., not by hand.

### ZK_VERIFY_FAILED

The CoFHE verifier did not accept the proof, or could not be reached. `httpStatus` is set when it answered.

- No `httpStatus`: the verifier is unreachable. Check the network and, in a browser, that the request is not blocked.
- A `4xx`: the request was rejected. The message carries the verifier's reason. The proof is bound to the account, chain, security zone and consuming contract, so check those first.
- A `5xx`: the verifier failed. Retry.

### INIT_TFHE_FAILED

The TFHE WASM module did not load. `cause` has the loader error.

- Vite: exclude `tfhe` from dependency prebundling, otherwise the `.wasm` file is not found (a "magic word" error).
  ```ts
  export default defineConfig({ optimizeDeps: { exclude: ['tfhe'] }, worker: { format: 'es' } });
  ```
- The client was created from the wrong entrypoint for the runtime (`/web` in Node.js or `/node` in a browser bundle).
- Server-side rendering: create the client and call `encryptInputs` in the browser only.

### FETCH_KEYS_FAILED

The FHE public key or the CRS could not be fetched from CoFHE. `cause` says whether the request failed, the response was malformed, or the chain is not FHE-enabled. Check network access to the chain's `coFheUrl`. Keys are cached after the first fetch.

### MISSING_FHE_KEY

No FHE public key was available after fetching. Treat as [FETCH_KEYS_FAILED](#fetch_keys_failed). If it follows a storage problem, clear the stored keys or disable the cache with `fheKeyStorage: null`.

### MISSING_CRS

No CRS was available for the chain after fetching. Treat as [FETCH_KEYS_FAILED](#fetch_keys_failed).

### REHYDRATE_KEYS_STORE_FAILED

The stored FHE keys could not be read (IndexedDB in the browser, the filesystem in Node.js). `cause` has the storage error. Clear the stored keys, pass a working `fheKeyStorage`, or set `fheKeyStorage: null` to fetch keys on every run.

### MISSING_ZK_BUILDER_AND_CRS_GENERATOR

The client lacks its platform parts because it was created with `createCofheClientBase`. Create it with `createCofheClient` from `@cofhe/sdk/node` or `@cofhe/sdk/web`.

### MISSING_TFHE_PUBLIC_KEY_DESERIALIZER

Same cause and fix as [MISSING_ZK_BUILDER_AND_CRS_GENERATOR](#missing_zk_builder_and_crs_generator).

### MISSING_COMPACT_PKE_CRS_DESERIALIZER

Same cause and fix as [MISSING_ZK_BUILDER_AND_CRS_GENERATOR](#missing_zk_builder_and_crs_generator).

## Decrypting

Decryption checks access on chain. A handle is decryptable by an account only after a transaction granted it (`FHE.allowSender`, `FHE.allow`), and the network sees that grant about a block after your RPC does. Wait for the receipt of that transaction before decrypting.

### ACP_NOT_FOUND

There is no ACP to decrypt with: none is active for this account and chain, or the hash given is not stored.

```ts
await client.acp.getOrCreateSelfACP(); // one wallet signature, reused until it expires
```

- ACPs are stored per account and per chain. After the user switches either, create one again.
- In React, `useCofheCreateACP` creates one; the read and decrypt hooks stay disabled until an ACP is valid (`disabledDueToMissingValidACP`).
- For a handle anyone may decrypt, `decryptForTx` needs no ACP: `.withoutACP()`.

### ACP_DENIED

The network found no grant that lets this ACP decrypt this handle. It also answers this for a revoked ACP and for a handle that does not exist.

1. **The grant is not visible yet.** Decrypting right after the transaction that grants access: wait for its receipt, and let the SDK retry for a few seconds.
   ```ts
   await client.decryptForView(handle, FheTypes.Uint64).setAccessDeniedRetryTimeout(10_000).execute();
   ```
2. **The contract never granted access.** After computing the value it must call `FHE.allowSender(value)` or `FHE.allow(value, account)`, and `FHE.allowThis(value)` to keep using it.
3. **Wrong account or chain.** The ACP's issuer is not the account that was granted access, or the handle is from another chain.
4. **A shared ACP that does not cover the handle.** `await client.acp.checkAccess(acp, handle)` says which: `'out-of-scope'`, `'issuer-not-allowed'`, `'revoked'`.

### ACP_EXPIRED

The ACP is past its expiration. Create a new one: `await client.acp.getOrCreateSelfACP()` replaces an expired active ACP. The lifetime is `defaultACPExpiration` in the config (seconds, default 7 days).

### ACP_INVALID

The network rejected the ACP's signature. The ACP was signed by a different account than its issuer, or for a different chain, or was altered after signing. Create a new one with the connected account. A shared ACP must be imported with `client.acp.importShared` so that the recipient signs it.

### ACP_MALFORMED

The network could not parse the ACP. It was built or edited by hand, or deserialized from JSON of another version. Create it with `client.acp.createSelf` / `createSharing` and pass it unchanged.

### ACP_REQUIRED

`decryptForView` was sent without an ACP. It always needs one: see [ACP_NOT_FOUND](#acp_not_found).

### ACP_REVOKED

Not sent by the current network, which reports a revoked ACP as [ACP_DENIED](#acp_denied). If it appears: the ACP was revoked on chain; create a new one.

### NOT_PUBLICLY_ALLOWED

`decryptForTx` ran without an ACP (`.withoutACP()`) on a handle that is not publicly decryptable.

- If access is restricted to an account, decrypt with its ACP: `.withACP()`.
- If the handle should be public, the contract must allow that for the value, in a transaction mined before the decrypt.
- Right after that transaction, the network may not have seen it: add `.setAccessDeniedRetryTimeout(ms)`.

### CT_NOT_FOUND

Access is fine, but the network has no ciphertext for the handle. Waiting does not help and the SDK does not retry.

- The handle was read from a different chain or environment than the client is connected to.
- The handle is `0`. That means the contract has not stored an encrypted value there: treat it as "no value" and skip the decrypt.
- The value is not a handle (a plain `uint`, or a stale value from a redeployed contract).

### CHAIN_ID_MISMATCH

The ACP was signed for one chain and the decrypt targets another. `context` has both ids. Use an ACP created on the chain of the handle, or drop the `chainId` override.

### INVALID_UTYPE

`decryptForView` was given a type it cannot decrypt to. Pass `FheTypes.Bool`, `Uint8`, `Uint16`, `Uint32`, `Uint64`, `Uint128` or `Uint160` (an address), the one matching the Solidity type of the handle. The other `FheTypes` members are not supported.

### UNSUPPORTED_TYPE

The network does not support the encryption type of the handle. Use one of the supported Solidity types (`ebool`, `euint8` to `euint128`, `eaddress`).

### UNSUPPORTED_SECURITY_ZONE

The network does not serve the security zone the handle was encrypted for. Encrypt in the default zone (0) unless the deployment documents another.

### UNKNOWN_CHAIN

The Threshold Network at the chain's `thresholdNetworkUrl` does not serve this chain id. With a hand-written chain object, use the one from `@cofhe/sdk/chains` instead.

### BAD_REQUEST

The network rejected the request as malformed. The message has its reason. Check that the handle is the value read from the contract, unchanged; if the request looks right, update `@cofhe/sdk`.

### DECRYPT_FAILED

`decryptForTx` failed without a more specific code.

- **`not ready after retrying for …ms`**: the network kept answering "not ready". Try again later.
- **`decrypt request failed`** with no `httpStatus`: the network is unreachable.
- A response that could not be parsed: the SDK and the network disagree on the format; update `@cofhe/sdk`.

### DECRYPT_RETURNED_NULL

The network's decrypt response lacked the value or the signature. Retry; if it persists, update `@cofhe/sdk`.

### SEAL_OUTPUT_FAILED

`decryptForView` failed without a more specific code.

- **`not ready after retrying for …ms`**: the network kept answering "not ready". Try again later.
- **`sealOutput request failed`** with no `httpStatus`: the network is unreachable.
- **`Failed to unseal decrypt response`**: the response was sealed for another key than the ACP's. The ACP object was rebuilt or altered; use the stored one (`client.acp.getActiveACP()`).

### SEAL_OUTPUT_RETURNED_NULL

The network's response had no sealed data. Retry; if it persists, update `@cofhe/sdk`.

### INTERNAL_ERROR

A failure the SDK has no specific code for: an unexpected exception (see `cause`), or the Threshold Network reporting an internal error (`apiErrorCode: 'internal_error'`). A network-side one is not caused by the request; retry later.

### SIGNING_FAILED

The Threshold Network could not sign the result. Network-side; retry later.

### SEAL_FAILED

The Threshold Network could not seal the result. Network-side; retry later.

### CT_SOURCE_ERROR

The Threshold Network could not load the ciphertext. Network-side; retry later.

### CT_SOURCE_TIMEOUT

The Threshold Network timed out loading the ciphertext. Network-side; retry later.

### ACP_VERIFIER_ERROR

The Threshold Network could not verify the ACP against the chain. Network-side; retry later.

### ACP_VERIFIER_TIMEOUT

The Threshold Network timed out verifying the ACP against the chain. Network-side; retry later.

## Local mocks

These appear only on a local chain (Hardhat, Anvil), where the SDK calls mock contracts instead of the CoFHE services.

### ZK_MOCKS_CALC_CT_HASHES_FAILED

The call to the mock ZK verifier failed. The mocks are not deployed on this chain, or their version does not match the SDK. Let `@cofhe/hardhat-plugin` deploy them, and keep `@cofhe/sdk`, `@cofhe/hardhat-plugin` and `@cofhe/mock-contracts` on the same version. `cause` has the revert.

### ZK_MOCKS_INSERT_CT_HASHES_FAILED

The transaction storing the mock ciphertexts failed. Same causes and fix as [ZK_MOCKS_CALC_CT_HASHES_FAILED](#zk_mocks_calc_ct_hashes_failed).

### ZK_MOCKS_CREATE_PROOF_SIGNATURE_FAILED

Signing the mock batch failed. Same causes and fix as [ZK_MOCKS_CALC_CT_HASHES_FAILED](#zk_mocks_calc_ct_hashes_failed).

## Codes this version does not throw

They remain in `CofheErrorCode` for compatibility. Code that handles them can be removed.

### UNKNOWN_ENVIRONMENT

Not thrown by this version.

### INIT_VIEM_FAILED

Not thrown by this version.

### INIT_ETHERS_FAILED

Not thrown by this version.

### MISSING_PROVIDER_PARAM

Not thrown by this version.

### EMPTY_SECURITY_ZONES_PARAM

Not thrown by this version.

### INVALID_ACP_DATA

Not thrown by this version.

### INVALID_ACP_DOMAIN

Not thrown by this version.

### CANNOT_REMOVE_LAST_ACP

Not thrown by this version.

### ZK_MOCKS_VERIFY_SIGN_FAILED

Not thrown by this version.

### ZK_PROVE_FAILED

Not thrown by this version.

### ENCRYPT_REMAINING_IN_ITEMS

Not thrown by this version.

### ZK_UNINITIALIZED

Not thrown by this version.

### PUBLIC_WALLET_GET_ADDRESSES_FAILED

Not thrown by this version. `connect` reports a wallet client without an account as [WALLET_CLIENT_ACCOUNT_MISSING](#wallet_client_account_missing).
