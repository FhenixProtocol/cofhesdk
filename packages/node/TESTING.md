# Testing Guide for @cofhesdk/node

This package has two types of tests:

## Unit Tests (Mocked)

Fast tests that mock node-tfhe and external dependencies. Run these for quick feedback during development.

```bash
pnpm test:unit
```

**What they test:**

- Client initialization
- Connection lifecycle
- Builder pattern
- State management
- Error handling with mocks

**Characteristics:**

- Fast (< 1 second)
- No external dependencies
- Run in CI/CD

## Integration Tests (Real)

Slower tests that use actual node-tfhe encryption and real CoFHE servers. Run these to verify real functionality.

```bash
pnpm test:integration
```

**What they test:**

- Real TFHE initialization with node-tfhe
- Actual encryption operations
- Real network requests to CoFHE servers
- End-to-end encryption flow
- Performance characteristics

**Characteristics:**

- Slow (minutes)
- Requires environment configuration
- Tests actual cryptographic operations

### Environment Variables

Integration tests require these environment variables:

```bash
# Required: Arbitrum Sepolia RPC URL
export ARB_SEPOLIA_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"

# Required: CoFHE server URL (for key fetching)
export COFHE_URL="http://localhost:3001"

# Required: ZK Verifier server URL (for proof verification)
export VERIFIER_URL="http://localhost:3002"
```

### Running Integration Tests

1. **Set up environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your values
   source .env
   ```

2. **Ensure CoFHE servers are running:**

   - CoFHE server should be accessible at `$COFHE_URL`
   - ZK Verifier should be accessible at `$VERIFIER_URL`

3. **Run integration tests:**
   ```bash
   pnpm test:integration
   ```

### Running All Tests

```bash
# Run all tests (unit + integration)
pnpm test
```

## Test Files

- `*.test.ts` - Unit tests with mocks
- `*.integration.test.ts` - Integration tests with real dependencies

## Skipping Tests

Integration tests automatically skip if environment variables are not set:

```typescript
// Will skip if ARB_SEPOLIA_RPC_URL is not set
const skipIfNoRpc = process.env.ARB_SEPOLIA_RPC_URL ? it : it.skip;

skipIfNoRpc('should connect to real chain', async () => {
  // test code
});
```

## CI/CD

Only unit tests run in CI/CD by default. Integration tests require:

- Access to CoFHE infrastructure
- Configured environment variables
- Longer timeout limits

To enable integration tests in CI:

```yaml
env:
  ARB_SEPOLIA_RPC_URL: ${{ secrets.ARB_SEPOLIA_RPC_URL }}
  COFHE_URL: ${{ secrets.COFHE_URL }}
  VERIFIER_URL: ${{ secrets.VERIFIER_URL }}
```

## Coverage

```bash
# Unit test coverage
pnpm coverage:unit

# Integration test coverage
pnpm coverage:integration

# Combined coverage
pnpm coverage
```
