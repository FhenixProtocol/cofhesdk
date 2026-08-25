# @cofhe/abi

Type-safe ABI utilities for Fhenix fully homomorphic encryption (FHE) smart contracts. Provides type-safe transformations between encrypted input/output types and their underlying primitive values.

## Overview

Fhenix contracts use encrypted types (e.g., `euint32`, `ebool`) in their ABIs. This package bridges the gap between:

- **Encrypted types** (`externalEuint32` for inputs, `euint32` for outputs) - the ABI representation
- **Primitive types** (`bigint`, `boolean`, `string`) - developer-friendly values
- **Encryptable types** (`EncryptableItem`) - intermediate encryption format

> **Calling convention for encrypted inputs.** Encrypted inputs are `external*` handles — plain
> `bytes32`-based value types, not structs — and a single signature authenticates the whole batch.
> Any ABI function with one or more `external*` inputs must therefore end with a plain `bytes`
> parameter, the slot that receives that shared batch signature. `extractEncryptableValues` and
> `insertEncryptedValues` throw if a function has `external*` inputs but its last parameter isn't
> `bytes`.

The package provides compile-time type safety through TypeScript generics, ensuring encrypted values are correctly extracted, transformed, and inserted based on ABI definitions.

## Installation

```bash
npm install @cofhe/abi
# or
pnpm add @cofhe/abi
# or
yarn add @cofhe/abi
```

**Peer Dependencies:**

- `@cofhe/sdk` - Core encryption types and utilities
- `abitype` - ABI type utilities

## Quick Start

```typescript
import { extractEncryptableValues, insertEncryptedValues, transformEncryptedReturnTypes } from '@cofhe/abi';
import type { CofheInputArgs, CofheInputArgsPreTransform, CofheReturnType } from '@cofhe/abi';

const abi = [
  {
    type: 'function',
    name: 'add',
    inputs: [
      { name: 'a', type: 'uint256', internalType: 'uint256' },
      { name: 'b', type: 'bytes32', internalType: 'externalEuint32' },
      // Required trailing slot: receives the shared batch signature.
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes32', internalType: 'euint32' }],
    stateMutability: 'nonpayable',
  },
] as const;

// 1. Prepare arguments with primitive values.
//    The trailing signature parameter is NOT part of the pre-transform shape - you never supply it.
const args: CofheInputArgsPreTransform<typeof abi, 'add'> = [100n, 200n];

// 2. Extract encryptable values
const encryptables = extractEncryptableValues(abi, 'add', args);
//    ^? [Encryptable.uint32(200n)]

// 3. Encrypt the values - one hash per input, followed by one signature for the whole batch
const encrypted = await client.encryptInputs(encryptables).setConsumingContract(contractAddress).execute();
//    ^? [ExternalUint32Hash, ExternalHashProof]

// 4. Insert encrypted values back into arguments (the signature lands in the trailing slot)
const encryptedArgs: CofheInputArgs<typeof abi, 'add'> = insertEncryptedValues(abi, 'add', args, encrypted);
//    ^? [100n, ExternalUint32Hash, ExternalHashProof]

// 5. Call contract and transform return value
const result = await contract.add(...encryptedArgs);
//    ^? bigint

// 6. Transform raw return value into correct encrypted value type
const transformed: CofheReturnType<typeof abi, 'add'> = transformEncryptedReturnTypes(abi, 'add', result);
//    ^? Euint32
```

## Public API Reference

### Return Types

#### `CofheReturnType<abi, functionName, args?>`

Type-level utility that infers the return type of a function, transforming encrypted return types to their typed representations.

**Type Parameters:**

- `abi` - Contract ABI (must be `const`-asserted for type inference)
- `functionName` - Function name (string literal)
- `args` - Optional function arguments for overload disambiguation

**Returns:**

- Transformed return type where encrypted types (`euint32`, `ebool`, etc.) are converted to typed objects (`{ ctHash: bigint, utype: FheTypes }`)
- Non-encrypted types remain unchanged
- Supports single values, tuples, arrays, and nested structures

**Supported Encrypted Return Types:**

- `ebool` → `{ ctHash: bigint; utype: FheTypes.Bool }`
- `euint8` → `{ ctHash: bigint; utype: FheTypes.Uint8 }`
- `euint16` → `{ ctHash: bigint; utype: FheTypes.Uint16 }`
- `euint32` → `{ ctHash: bigint; utype: FheTypes.Uint32 }`
- `euint64` → `{ ctHash: bigint; utype: FheTypes.Uint64 }`
- `euint128` → `{ ctHash: bigint; utype: FheTypes.Uint128 }`
- `eaddress` → `{ ctHash: bigint; utype: FheTypes.Uint160 }`

#### `transformEncryptedReturnTypes(abi, functionName, data)`

Runtime function that transforms contract return values from `bigint` ciphertext hashes to typed encrypted return objects.

**Parameters:**

- `abi` - Contract ABI
- `functionName` - Function name
- `data` - Raw return value(s) from contract call (single value or array)

**Returns:**
Transformed return value matching `CofheReturnType<abi, functionName>`
Works with multiple return values, nested structures and arrays.

### Encrypted Inputs

#### `CofheInputArgs<abi, functionName>`

Type-level utility that infers function input arguments with encrypted types represented as external handle types.

**Type Parameters:**

- `abi` - Contract ABI (must be `const`-asserted for type inference)
- `functionName` - Function name (string literal)

**Returns:**

- Tuple type where encrypted inputs are represented as branded external handles (`ExternalUint32Hash`, `ExternalBoolHash`, etc.)
- Non-encrypted types use their primitive representations
- Includes the trailing `bytes` signature parameter (typed `ExternalHashProof`), since this is the shape passed to the contract

#### `CofheInputArgsPreTransform<abi, functionName>`

Type-level utility that infers function input arguments with encrypted types represented as their underlying primitive values (before encryption).

**Type Parameters:**

- `abi` - Contract ABI (must be `const`-asserted for type inference)
- `functionName` - Function name (string literal)

**Returns:**

- Tuple type where encrypted inputs use primitive types (`bigint` for uints, `boolean` for bool, `string` for address)
- When the function has `external*` inputs, the trailing `bytes` signature parameter is **dropped** — callers never supply it; the SDK injects it after encryption
- This is the format you provide to `extractEncryptableValues`

**Supported Encrypted Input Types:**

- `externalEbool` → `boolean` (pre-transform) → `ExternalBoolHash` (post-transform)
- `externalEuint8` → `bigint | string` → `ExternalUint8Hash`
- `externalEuint16` → `bigint | string` → `ExternalUint16Hash`
- `externalEuint32` → `bigint | string` → `ExternalUint32Hash`
- `externalEuint64` → `bigint | string` → `ExternalUint64Hash`
- `externalEuint128` → `bigint | string` → `ExternalUint128Hash`
- `externalEaddress` → `string | bigint` → `ExternalAddressHash`

#### `extractEncryptableValues(abi, functionName, args)`

Extracts encryptable values from function arguments, converting primitive values to `EncryptableItem` objects ready for encryption.

**Parameters:**

- `abi` - Contract ABI
- `functionName` - Function name
- `args` - Function arguments in `CofheInputArgsPreTransform` format (primitives)

**Returns:**
Flat array of `EncryptableItem` objects in the order they appear in the ABI (depth-first traversal).
Works with arrays (fixed length or unbounded) and nested structures.

#### `insertEncryptedValues(abi, functionName, args, encryptedValues)`

Re-inserts encrypted values back into function arguments, replacing primitive values with their external handles and appending the shared batch signature.

**Parameters:**

- `abi` - Contract ABI
- `functionName` - Function name
- `args` - Original function arguments in `CofheInputArgsPreTransform` format
- `encryptedResult` - `readonly \`0x${string}\`[]`— the`[...hashes, signature]`tuple returned by`EncryptInputsBuilder.execute()`: one hash per encryptable, in the order returned by `extractEncryptableValues`, followed by the single batch signature

**Returns:**
Function arguments in `CofheInputArgs` format (ready for contract calls), with the batch signature placed in the function's trailing `bytes` slot.
