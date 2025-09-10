# `@cofhesdk/adapters`

Collection of cofhesdk adapters for initialization. Cofhesdk uses viem clients internally for reading data and signing transactions, each adapter converts incoming providers into viem clients.

## Installation

```bash
npm install @cofhesdk/adapters
# or
pnpm add @cofhesdk/adapters
# or
yarn add @cofhesdk/adapters
```

## Supported Adapters

- **Wagmi** - Convert Wagmi public/wallet clients to standardized format
- **Viem** - Direct Viem client integration with EIP-1193 providers
- **Ethers v5** - Convert Ethers.js v5 providers and signers
- **Ethers v6** - Convert Ethers.js v6 providers and signers  
- **Hardhat** - Convert Hardhat ethers signers and providers

## Usage

All adapters take a **signer** and **provider** and return viem clients:

```typescript
interface AdapterResult {
  publicClient: PublicClient  // For reading blockchain data
  walletClient: WalletClient  // For signing transactions
}
```

### Ethers v5 Adapter

```typescript
import { Ethers5Adapter } from '@cofhesdk/adapters'
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider('https://your-rpc-url')
const signer = new ethers.Wallet('your-private-key', provider)

const { publicClient, walletClient } = Ethers5Adapter(signer, provider)
```

### Ethers v6 Adapter

```typescript
import { Ethers6Adapter } from '@cofhesdk/adapters'
import { ethers } from 'ethers'

const provider = new ethers.JsonRpcProvider('https://your-rpc-url')
const signer = new ethers.Wallet('your-private-key', provider)

const { publicClient, walletClient } = Ethers6Adapter(signer, provider)
```

### Viem Adapter

```typescript
import { ViemAdapter } from '@cofhesdk/adapters'

// With window.ethereum (browser)
const { publicClient, walletClient } = ViemAdapter(null, window.ethereum)
```

### Wagmi Adapter

```typescript
import { WagmiAdapter } from '@cofhesdk/adapters'
import { useWalletClient, usePublicClient } from 'wagmi'

const publicClient = usePublicClient()
const { data: walletClient } = useWalletClient()

const { publicClient: viemPublic, walletClient: viemWallet } = WagmiAdapter(walletClient, publicClient)
```

### Hardhat Adapter

```typescript
import { HardhatSignerAdapter } from '@cofhesdk/adapters'

// In a Hardhat script or test
const [signer] = await hre.ethers.getSigners()
const provider = hre.ethers.provider

const { publicClient, walletClient } = HardhatSignerAdapter(signer, provider)
```

## EIP-1193 Compatibility

All adapters ensure full EIP-1193 compatibility, providing access to:

- Chain ID retrieval
- Account management
- Transaction signing and sending
- Contract read/write operations
- Event listening
- Gas estimation

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type { 
  AdapterResult, 
  AdapterConfig,
  ViemAdapterConfig,
  WagmiAdapterConfig,
  Ethers5AdapterConfig,
  Ethers6AdapterConfig,
  HardhatAdapterConfig 
} from '@cofhesdk/adapters'
```
