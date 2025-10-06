# @cofhesdk/web

CoFHE SDK for web browsers with TFHE integration.

## Installation

```bash
npm install @cofhesdk/web
# or
pnpm add @cofhesdk/web
# or
yarn add @cofhesdk/web
```

## Usage

```typescript
import { initTfhe, createCofhesdkClient, createCofhesdkConfig, FheTypes } from '@cofhesdk/web';

// Initialize TFHE (call this once at app startup)
await initTfhe();

// Create configuration
const config = createCofhesdkConfig({
  supportedChains: [
    /* your chains */
  ],
});

// Create client (TFHE dependencies are automatically injected)
const client = createCofhesdkClient(config);

// Connect with viem clients
await client.connect(publicClient, walletClient);

// Use the client for encryption/decryption
const encryptedInputs = await client.encryptInputs([{ data: 42n, utype: FheTypes.Uint64 }]).encrypt();
```

## API

This package re-exports all functionality from `@cofhesdk/core` and provides a web-optimized `createCofhesdkClient` that automatically configures TFHE dependencies.

### `createCofhesdkClient(config: CofhesdkConfig): CofhesdkClient`

Creates a CoFHE SDK client instance for web browsers with TFHE automatically configured. You only need to pass the configuration - all TFHE-specific serializers, generators, and initialization are handled automatically.

**TFHE initialization happens automatically on first encryption** - no manual setup required!

- `config` - The CoFHE SDK configuration

### Advanced exports (typically not needed)

If you need direct access to the TFHE utilities for advanced use cases:

- `tfhePublicKeySerializer` - Serializer for TFHE public keys
- `compactPkeCrsSerializer` - Serializer for Compact PKE CRS
- `zkBuilderAndCrsGenerator` - Generator for ZK builders and CRS

## License

MIT
