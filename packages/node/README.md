# @cofhesdk/node

CoFHE SDK for Node.js with node-tfhe integration.

## Installation

```bash
npm install @cofhesdk/node
# or
pnpm add @cofhesdk/node
# or
yarn add @cofhesdk/node
```

## Usage

```typescript
import { createCofhesdkClient, createCofhesdkConfig, FheTypes } from '@cofhesdk/node';

// Create configuration
const config = createCofhesdkConfig({
  supportedChains: [
    /* your chains */
  ],
});

// Create client (TFHE will be initialized automatically on first use)
const client = createCofhesdkClient(config);

// Connect with viem clients
await client.connect(publicClient, walletClient);

// Use the client for encryption/decryption
// TFHE will be initialized automatically before the first encryption
const encryptedInputs = await client.encryptInputs([{ data: 42n, utype: FheTypes.Uint64 }]).encrypt();
```

## API

This package re-exports all functionality from `@cofhesdk/core` and provides a Node.js-optimized `createCofhesdkClient` that automatically configures node-tfhe dependencies.

### `createCofhesdkClient(config: CofhesdkConfig): CofhesdkClient`

Creates a CoFHE SDK client instance for Node.js with node-tfhe automatically configured. You only need to pass the configuration - all TFHE-specific serializers, generators, and initialization are handled automatically.

**TFHE initialization happens automatically on first encryption** - no manual setup required!

- `config` - The CoFHE SDK configuration

### Advanced exports (typically not needed)

If you need direct access to the TFHE utilities for advanced use cases:

- `tfhePublicKeySerializer` - Serializer for TFHE public keys
- `compactPkeCrsSerializer` - Serializer for Compact PKE CRS
- `zkBuilderAndCrsGenerator` - Generator for ZK builders and CRS

## Testing

See [TESTING.md](./TESTING.md) for detailed testing documentation.

### Quick Start

```bash
# Unit tests (fast, mocked)
pnpm test:unit

# Integration tests (slow, real encryption)
pnpm test:integration

# All tests
pnpm test
```

### Integration Tests

Integration tests use real node-tfhe encryption and require environment setup:

```bash
export ARB_SEPOLIA_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
export COFHE_URL="http://localhost:3001"
export VERIFIER_URL="http://localhost:3002"

pnpm test:integration
```

Integration tests are automatically skipped if environment variables are not configured.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run linter
pnpm lint

# Type check
pnpm type-check

# Run tests in watch mode
pnpm test

# Generate coverage
pnpm coverage
```

## License

MIT
