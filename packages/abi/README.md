# @cofhe/abi

Type-safe ABI utilities for Fhenix fully homomorphic encryption (FHE) smart contracts. Provides type-safe transformations between encrypted input/output types and their underlying primitive values.

## Overview

Fhenix contracts use encrypted types (e.g., `euint32`, `ebool`) that are represented as structs in ABIs. This package bridges the gap between:

- **Encrypted types** (`struct InEuint32`, `euint32`) - the ABI representation
- **Primitive types** (`bigint`, `boolean`, `string`) - developer-friendly values
- **Encryptable types** (`EncryptableItem`) - intermediate encryption format

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
import { encrypt } from '@cofhe/sdk';

const abi = [
  {
    type: 'function',
    name: 'add',
    inputs: [
      { name: 'a', type: 'uint256', internalType: 'uint256' },
      { name: 'b', type: 'tuple', internalType: 'struct InEuint32', components: [...] }
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'euint32' }],
    stateMutability: 'nonpayable'
  }
] as const;

// 1. Prepare arguments with primitive values
const args: CofheInputArgsPreTransform<typeof abi, 'add'> = [100n, 200n];

// 2. Extract encryptable values
const encryptables = extractEncryptableValues(abi, 'add', args);
//    ^? [Encryptable.uint32(200n)]

// 3. Encrypt the values
const encrypted = await encrypt(encryptables);
//    ^? [EncryptedUint32Input]

// 4. Insert encrypted values back into arguments
const encryptedArgs: CofheInputArgs<typeof abi, 'add'> = insertEncryptedValues(abi, 'add', args, encrypted);
//    ^? [100n, EncryptedUint32Input]

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

Type-level utility that infers function input arguments with encrypted types represented as encrypted input structs.

**Type Parameters:**

- `abi` - Contract ABI (must be `const`-asserted for type inference)
- `functionName` - Function name (string literal)

**Returns:**

- Tuple type where encrypted inputs are represented as encrypted input structs (`EncryptedUint32Input`, `EncryptedBoolInput`, etc.)
- Non-encrypted types use their primitive representations

#### `CofheInputArgsPreTransform<abi, functionName>`

Type-level utility that infers function input arguments with encrypted types represented as their underlying primitive values (before encryption).

**Type Parameters:**

- `abi` - Contract ABI (must be `const`-asserted for type inference)
- `functionName` - Function name (string literal)

**Returns:**

- Tuple type where encrypted inputs use primitive types (`bigint` for uints, `boolean` for bool, `string` for address)
- This is the format you provide to `extractEncryptableValues`

**Supported Encrypted Input Types:**

- `struct InEbool` → `boolean` (pre-transform) → `EncryptedBoolInput` (post-transform)
- `struct InEuint8` → `bigint | string` → `EncryptedUint8Input`
- `struct InEuint16` → `bigint | string` → `EncryptedUint16Input`
- `struct InEuint32` → `bigint | string` → `EncryptedUint32Input`
- `struct InEuint64` → `bigint | string` → `EncryptedUint64Input`
- `struct InEuint128` → `bigint | string` → `EncryptedUint128Input`
- `struct InEaddress` → `string | bigint` → `EncryptedAddressInput`

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

Re-inserts encrypted values back into function arguments, replacing primitive values with encrypted input structs.

**Parameters:**

- `abi` - Contract ABI
- `functionName` - Function name
- `args` - Original function arguments in `CofheInputArgsPreTransform` format
- `encryptedValues` - Array of encrypted values in the same order as returned by `extractEncryptableValues`

**Returns:**
Function arguments in `CofheInputArgs` format (ready for contract calls)
