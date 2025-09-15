# @cofhesdk/chains

Chain configurations for `cofhesdk`. Used internally by `@cofhesdk/core`. Should only need to be used in `cofhesdk.config.ts` in the `supportedChains` field.

## Usage

```typescript
import { sepolia, arbSepolia, baseSepolia, hardhat, chains, getChainById, getChainByName } from '@cofhesdk/chains';

// Use individual chains
console.log(sepolia.name); // "Sepolia"

// Find chains
const chain = getChainById(11155111); // sepolia
const chainByName = getChainByName('sepolia'); // sepolia

// Access all chains
Object.values(chains);
```

## Available Chains

- **Sepolia** (11155111) - Ethereum testnet
- **Arbitrum Sepolia** (421614) - Arbitrum testnet
- **Base Sepolia** (84532) - Base testnet
- **Hardhat** (31337) - Local development

## License

MIT
