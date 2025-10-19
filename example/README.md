# CoFHE SDK React Components Example

This example demonstrates how to use the CoFHE SDK React components in a real application.

## Features

- **Interactive Examples**: Live demonstrations of all React components
- **Dark Mode Support**: Toggle between light and dark themes
- **Real-time Status**: Connection status and operation feedback
- **Material-UI Integration**: Beautiful icons and consistent design
- **TypeScript Support**: Full type safety and IntelliSense

## Components Showcased

1. **EncryptionButton** - Simple button for single value encryption
2. **EncryptionForm** - Multi-field form for batch encryption
3. **FnxEncryptInput** - Advanced input with type selection and progress
4. **CofheStatus** - Connection status indicator
5. **React Hooks** - Direct hook usage examples

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

### Development

```bash
# Start the development server
pnpm dev
```

The example will be available at `http://localhost:3000`

## Project Structure

```
example/
├── src/
│   ├── components/
│   │   ├── examples/          # Component demonstrations
│   │   ├── Navigation.tsx     # Sidebar navigation
│   │   └── ComponentRenderer.tsx
│   ├── providers/
│   │   └── ExampleProvider.tsx # CoFHE SDK setup
│   ├── styles.css             # Tailwind CSS
│   └── main.tsx              # App entry point
├── public/
│   └── index.html
└── package.json
```

## Usage in Your Project

After exploring the examples, you can use these components in your own project:

```bash
npm install @cofhesdk/react @cofhesdk/web @cofhesdk/adapters @mui/icons-material @mui/material
```

```tsx
import { CofheProvider, FnxEncryptInput } from '@cofhesdk/react';
import { createCofhesdkClient } from '@cofhesdk/web';

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

## Configuration

The example uses a mock private key and Sepolia testnet for demonstration purposes. 
**DO NOT use the mock private key in production!**

For production use, replace the initialization in `ExampleProvider.tsx` with your actual wallet connection logic.
