# @cofhesdk/permits

Create, manage, and store user permits for CoFHE coprocessor authentication.

Permits are collections of user data with EIP712 signatures that validate authenticated users. They're sent to the CoFHE coprocessor as part of off-chain decryption requests, where they're checked on-chain against the ACL to determine if the `issuer` has access to requested encrypted variables.

This package is designed for internal usage within `@cofhesdk/core` but may be imported separately for advanced use cases. It uses viem clients, which are the standard shared providers/signers within cofhesdk.

## Requirements

- `viem` v2.0.0+ (peer dependency)

## Usage

### Create a Permit for Self-Usage

```typescript
import { PermitUtils } from '@cofhesdk/permits'

// Create a permit for yourself
const permit = await PermitUtils.create({
	type: 'self',
	issuer: '0x1234...',
	name: 'My Data Access',
	expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
})

// Sign the permit
const signedPermit = await PermitUtils.sign(permit, walletClient, publicClient)
```

### Create and Sign in One Step

```typescript
const permit = await PermitUtils.createAndSign(
	{
		type: 'self',
		issuer: '0x1234...',
		name: 'My Data Access',
		expiration: Math.floor(Date.now() / 1000) + 86400,
	},
	walletClient,
	publicClient
)
```

### Create a Permit to be Shared

```typescript
// Create a permit to share with another user
const sharingPermit = await PermitUtils.createAndSign(
	{
		type: 'sharing',
		issuer: '0x1234...',
		recipient: '0x5678...',
		name: 'Shared Data Access',
		expiration: Math.floor(Date.now() / 1000) + 86400,
	},
	walletClient,
	publicClient
)
```

### Receiving a Shared Permit

```typescript
// Import a shared permit from another user
const importingPermit = {
	issuer: '0x1234...',
	recipient: '0x5678...',
	issuerSignature: '0x...',
	name: 'Shared Data Access',
	expiration: 1234567890,
	validatorId: 0,
	validatorContract: '0x0000000000000000000000000000000000000000',
	sealingPair: {
		privateKey: '...',
		publicKey: '...',
	},
}

const importedPermit = PermitUtils.deserialize(importingPermit)

// Sign as recipient to activate the permit
const recipientPermit = await PermitUtils.sign(importedPermit, walletClient, publicClient)

// Store the activated permit
permitStore.setPermit(chainId, account, recipientPermit)
```

### Store and Retrieve Permits

```typescript
import { permitStore } from '@cofhesdk/permits'

// Store a permit
permitStore.setPermit(chainId, account, permit)

// Get active permit
const activePermit = permitStore.getActivePermit(chainId, account)

// Get all permits
const allPermits = permitStore.getPermits(chainId, account)

// Set active permit
permitStore.setActivePermitHash(chainId, account, permitHash)
```

### Validate Permits

```typescript
// Check if permit is valid
const isValid = PermitUtils.isValid(permit)

// Check if permit is expired
const isExpired = PermitUtils.isExpired(permit)

// Check if permit is signed
const isSigned = PermitUtils.isSigned(permit)
```

### Serialize/Deserialize

```typescript
// Serialize for storage
const serialized = PermitUtils.serialize(permit)

// Deserialize from storage
const deserialized = PermitUtils.deserialize(serialized)
```

### Unseal Encrypted Data

```typescript
// Unseal data using the permit's sealing key
const decryptedValue = PermitUtils.unseal(permit, encryptedData)
```

## API Reference

### PermitUtils

- `create(options)` - Create a new permit
- `createAndSign(options, walletClient, publicClient)` - Create and sign in one step
- `sign(permit, walletClient, publicClient)` - Sign an existing permit
- `validate(permit)` - Validate a permit
- `serialize(permit)` - Serialize for storage
- `deserialize(data)` - Deserialize from storage
- `isValid(permit)` - Check overall validity
- `isExpired(permit)` - Check if expired
- `isSigned(permit)` - Check if signed
- `unseal(permit, encryptedData)` - Decrypt data

### Storage

- `permitStore.setPermit(chainId, account, permit)` - Store permit
- `permitStore.getPermit(chainId, account, hash)` - Get specific permit
- `permitStore.getActivePermit(chainId, account)` - Get active permit
- `permitStore.getPermits(chainId, account)` - Get all permits
- `permitStore.removePermit(chainId, account, hash)` - Remove permit
