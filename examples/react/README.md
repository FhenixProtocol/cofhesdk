# CoFHE SDK React Example

This example demonstrates how to use the CoFHE SDK React components in a real application with Web Workers support.

## Features

- **Interactive Examples**: Live demonstrations of all React components
- **Dark Mode Support**: Toggle between light and dark themes
- **Real-time Status**: Connection status and operation feedback
- **Material-UI Integration**: Beautiful icons and consistent design
- **TypeScript Support**: Full type safety and IntelliSense
- **Web Workers**: Automatic offloading of heavy cryptographic operations
- **Real-time Progress**: See actual encryption steps with worker status

## Components Showcased

1. **FnxEncryptInput** - Advanced input with type selection and progress
2. **React Hooks** - Direct hook usage (`useEncryptInput`, `useCofheContext`)
3. **Worker Status Logging** - See worker performance in the console

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation & Run

```bash
# From the react example directory
cd examples/react

# Install dependencies (if not already installed)
pnpm install

# Start development server
pnpm dev
```

The example will be available at `http://localhost:3000`

### Building for Production

```bash
pnpm build
pnpm preview
```

## Project Structure

```
react/
├── src/
│   ├── components/
│   │   ├── examples/          # Component demonstrations
│   │   │   ├── Overview.tsx
│   │   │   ├── HooksExample.tsx
│   │   │   └── FnxEncryptInputExample.tsx
│   │   ├── Navigation.tsx     # Sidebar navigation
│   │   └── ComponentRenderer.tsx
│   ├── providers/
│   │   └── ExampleProvider.tsx # CoFHE SDK setup
│   ├── styles.css             # Tailwind CSS
│   ├── App.tsx
│   └── main.tsx              # App entry point
├── public/
├── vite.config.ts            # Vite + WASM configuration
└── package.json
```

## Features Demonstrated

### 1. Web Workers for Encryption

The example automatically uses Web Workers to offload heavy ZK proof generation. Check the browser console during encryption to see worker status:

```
[Encryption] Worker Status: {
  useWorker: true,
  usedWorker: true,
  workerFailedError: undefined,
  duration: "1234ms"
}
```

### 2. Real-time Progress

The encryption progress bar shows actual steps from the SDK:

- Initializing TFHE
- Fetching FHE keys
- Packing data
- Generating proof (with worker!)
- Verifying

### 3. Type-safe Development

Full TypeScript support with proper type inference for all components and hooks.

## Configuration

The example uses:

- **Network**: Arbitrum Sepolia testnet
- **Private Key**: Mock key for demonstration (line 12 of `ExampleProvider.tsx`)

⚠️ **DO NOT use the mock private key in production!**

For production, replace the initialization in `ExampleProvider.tsx` with your actual wallet connection logic (e.g., using WalletConnect, MetaMask, etc.).

## Usage in Your Project

After exploring the examples, you can use these components in your own project:

```bash
npm install @cofhe/react cofhesdk
```

```tsx
import { CofheProvider, FnxEncryptInput } from '@cofhe/react';
import { createCofhesdkClient, createCofhesdkConfig } from '@cofhe/sdk/web';
import { sepolia } from '@cofhe/sdk/chains';

const config = createCofhesdkConfig({
  supportedChains: [sepolia],
  useWorkers: true, // Enable Web Workers
});

const client = createCofhesdkClient(config);

function App() {
  return (
    <CofheProvider client={client}>
      <FnxEncryptInput
        placeholder="Enter value to encrypt..."
        showProgressBar={true}
        onEncryptComplete={(data) => console.log('Encrypted:', data)}
      />
    </CofheProvider>
  );
}
```

## Development Tips

### Viewing Worker Status

Open the browser console to see detailed worker status during encryption. This helps debug worker issues and measure performance.

### Hot Module Replacement

Vite's HMR works with the SDK. Changes to your code will hot-reload without losing connection state.

### WASM Configuration

The example includes proper Vite configuration for WASM modules. Check `vite.config.ts` for reference if integrating into your own project.

## Troubleshooting

### Workers Not Loading

If you see `usedWorker: false` in the console:

- Check browser console for errors
- Ensure CORS headers are set correctly (see `vite.config.ts`)
- Verify WASM files are being served properly

### Connection Issues

If you can't connect to the wallet:

- Ensure you're using a supported network
- Check that the RPC endpoint is accessible
- Verify the chain ID matches your network

## Learn More

- [SDK Documentation](../../packages/sdk/README.md)
- [React Package Documentation](../../packages/react/README.md)
- [Worker Implementation Guide](../../packages/sdk/HOW_TO_USE_WORKERS.md)
