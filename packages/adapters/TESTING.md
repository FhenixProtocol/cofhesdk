# Testing Guide for @cofhesdk/adapters

This document explains how to run and understand the tests for the adapters package.

## Test Framework

We use **Vitest** as our testing framework, which provides:
- Fast execution with native ESM support
- TypeScript support out of the box
- Jest-compatible API
- Built-in code coverage with v8

## Test Structure

```
test/
├── test-utils.ts          # Mock providers and test utilities
├── index.test.ts          # Tests for main exports
├── wagmi.test.ts          # Wagmi adapter tests
├── ethers5.test.ts        # Ethers v5 adapter tests
├── ethers6.test.ts        # Ethers v6 adapter tests
└── hardhat.test.ts        # Hardhat adapter tests
```

## Running Tests

### Individual Package (from adapters directory)

```bash
cd packages/adapters

# Run tests once
pnpm test:run

# Run tests in watch mode
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Monorepo (from root directory)

```bash
# Run tests for all packages using Turborepo
pnpm turbo run test

# Run tests once for all packages
pnpm turbo run test:run

# Run tests with coverage for all packages
pnpm turbo run test:coverage
```

## Test Coverage

Current test coverage: **95.83%**

Coverage breakdown:
- **Statements**: 95.83%
- **Branches**: 92.92%
- **Functions**: 96.15%
- **Lines**: 95.83%

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Text**: Displayed in terminal
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage.json` (for CI/CD)

## Test Categories

### 1. Adapter Function Tests
Tests that each adapter correctly:
- Creates viem public and wallet clients
- Handles different input types (providers, signers, etc.)
- Applies custom configuration (chain, RPC URL)
- Throws appropriate errors for invalid inputs

### 2. Integration Tests
Tests that verify:
- Adapters work with mock providers
- Return values have correct structure
- Error handling works as expected

### 3. Export Tests
Tests that verify:
- All functions are properly exported
- TypeScript types are available (at compile time)
- No unexpected exports are included

## Mock Providers

The test suite includes comprehensive mocks for:

- **EIP-1193 Provider**: Standard Ethereum provider interface
- **Ethers v5 Provider/Signer**: Legacy Ethers.js mocks
- **Ethers v6 Provider/Signer**: Modern Ethers.js mocks
- **Wagmi Clients**: Public and wallet client mocks
- **Hardhat Provider/Signer**: Development environment mocks

## Test Utilities

### `createMockEIP1193Provider()`
Creates a mock provider that implements the EIP-1193 standard with common methods:
- `eth_chainId`, `eth_accounts`, `eth_getBalance`
- `eth_blockNumber`, `eth_gasPrice`
- `personal_sign`, `eth_sendTransaction`

## Writing New Tests

When adding new adapters or features:

1. **Create adapter tests** in `test/{adapter-name}.test.ts`
2. **Use existing mocks** from `test-utils.ts` or create new ones
3. **Test error cases** - invalid inputs, missing providers, etc.
4. **Update export tests** in `index.test.ts`
5. **Aim for >95% coverage** on new code

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { YourAdapter } from '../your-adapter'
import { createMockProvider } from './test-utils'

describe('YourAdapter', () => {
  let mockProvider: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    mockProvider = createMockProvider()
  })

  it('should handle custom configuration', () => {
    const result = YourAdapter(mockProvider, { chain: sepolia })
    expect(result.publicClient.chain).toEqual(sepolia)
  })

  it('should throw error for invalid input', () => {
    expect(() => YourAdapter(null)).toThrow()
  })
})
```

## Continuous Integration

Tests run automatically in CI/CD pipelines:
- **On Pull Requests**: All tests must pass
- **Coverage Gates**: Minimum 90% coverage required
- **Turborepo Caching**: Tests are cached for faster subsequent runs

## Debugging Tests

### Common Issues

1. **Mock Provider Errors**: Ensure mocks implement all required EIP-1193 methods
2. **Type Errors**: TypeScript interfaces aren't available at runtime
3. **Async Issues**: Use proper `await` with async adapter functions

### Debug Commands

```bash
# Run specific test file
pnpm vitest run test/viem.test.ts

# Run tests with debug output
pnpm vitest run --reporter=verbose

# Run single test case
pnpm vitest run -t "should create valid adapter result"
```

## Performance

Test execution times:
- **Full test suite**: ~2.7 seconds
- **Individual adapters**: ~400-600ms each
- **With coverage**: ~2.8 seconds

The test suite is optimized for speed while maintaining comprehensive coverage.
