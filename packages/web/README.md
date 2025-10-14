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

- `tfhePublicKeyDeserializer` - Serializer for TFHE public keys
- `compactPkeCrsDeserializer` - Serializer for Compact PKE CRS
- `zkBuilderAndCrsGenerator` - Generator for ZK builders and CRS

## Testing

All tests in this package run in a **browser environment** using Playwright's Chromium.

### Running Tests

```bash
# Run tests in browser
pnpm test

# Run tests with coverage
pnpm coverage
```

Tests use real `tfhe` WASM and run in a headless Chromium browser. This ensures that:

- TFHE initialization works correctly in browsers
- WebAssembly modules load properly
- Encryption operations work end-to-end in the browser environment

### Test Configuration

Tests are configured via `vitest.config.mts` to:

- Run in headless Chromium (via Playwright)
- Use real tfhe WASM module
- Test real encryption operations
- Verify browser-specific APIs

All test files use the `.test.ts` suffix (no `.browser.test.ts` needed since all tests are browser tests).

## License

MIT
