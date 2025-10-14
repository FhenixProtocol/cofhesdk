# CoFHE Hardhat Plugin

A Hardhat plugin for Fully Homomorphic Encryption (FHE) development with CoFHE.

## Installation

```bash
npm install cofhe-hardhat-plugin
# or
yarn add cofhe-hardhat-plugin
# or
pnpm add cofhe-hardhat-plugin
```

## Configuration

Add the plugin to your Hardhat config:

```javascript
// hardhat.config.js or hardhat.config.ts
require("cofhe-hardhat-plugin");
// or if using TypeScript
import "cofhe-hardhat-plugin";

module.exports = {
  // ... other config
  cofhe: {
    logMocks: true, // Optional: Set to true to log mock operations
  },
  // Network configuration is automatically added by the plugin
};
```

The plugin automatically adds network configurations for:

- Hardhat network with deployed mock contracts
- Ethereum Sepolia testnet
- Arbitrum Sepolia testnet

## Features

### Mock Contracts

This plugin uses [cofhe-mock-contracts](https://github.com/FhenixProtocol/cofhe-mock-contracts) to provide on-chain simulations of the CoFHE system. These mock contracts enable development and testing without requiring the actual off-chain FHE computation engine.

The mock contracts include:

- MockTaskManager: Manages FHE operations and stores plaintext values
- MockQueryDecrypter: Handles decryption requests
- MockZkVerifier: Simulates verification of encrypted inputs
- ACL: Handles access control

Key differences from the real CoFHE system:

- Operations are performed on-chain instead of off-chain
- Plaintext values are stored on-chain for testing and verification
- Decryption operations are simulated with mock delays
- Operations are logged using hardhat/console.sol

### Mock Contracts Deployment

Mock contracts are automatically deployed when using the Hardhat network:

- Running tests: `npx hardhat test`
- Starting a local node: `npx hardhat node`

You can also manually deploy mock contracts:

```bash
npx hardhat deploy-mocks [--deploy-test-bed true|false] [--log-mocks true|false]
```

Options:

- `--deploy-test-bed`: Deploy the TestBed contract (default: true)
- `--log-mocks`: Log mock operations (default: true)

### Utility Functions

The plugin exports several utility functions for working with mock contracts:

#### Mock Utilities

```typescript
// Get plaintext value from a ciphertext hash
import { mock_getPlaintext } from "cofhe-hardhat-plugin";
const plaintext = await mock_getPlaintext(provider, ctHash);

// Check if a plaintext exists for a ciphertext hash
import { mock_getPlaintextExists } from "cofhe-hardhat-plugin";
const exists = await mock_getPlaintextExists(provider, ctHash);

// Test assertion for plaintext values
import { mock_expectPlaintext } from "cofhe-hardhat-plugin";
await mock_expectPlaintext(provider, ctHash, expectedValue);
```

#### Network Utilities

```typescript
// Get the CoFHE environment based on network name
import { getCofheEnvironmentFromNetwork } from "cofhe-hardhat-plugin";
const environment = getCofheEnvironmentFromNetwork(networkName);

// Check if a CoFHE environment is permitted for a given network
import { isPermittedCofheEnvironment } from "cofhe-hardhat-plugin";
const isPermitted = isPermittedCofheEnvironment(hre, environmentName);

// Initialize CoFHEjs with a Hardhat signer
import { cofhejs_initializeWithHardhatSigner } from "cofhe-hardhat-plugin";
await cofhejs_initializeWithHardhatSigner(signer, options);
```

## Usage in Tests

The plugin automatically deploys mock contracts when running tests:

```typescript
import { expect } from "chai";
import { mock_expectPlaintext } from "cofhe-hardhat-plugin";

describe("My FHE Contract", function() {
  it("should store encrypted value correctly", async function() {
    const [signer] = await ethers.getSigners();
    const myContract = await ethers.deployContract("MyFHEContract");

    // Interact with your contract
    const tx = await myContract.storeEncrypted(123);
    await tx.wait();

    // Get the ciphertext hash from event logs
    const ctHash = /* extract from logs */;

    // Verify plaintext value (only works on hardhat network)
    await mock_expectPlaintext(signer.provider, ctHash, 123n);
  });
});
```

## License

MIT
