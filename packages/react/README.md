# @cofhe/react

React component and hook for the CoFHE SDK - featuring the advanced CofheEncryptInput component.

## Installation

```bash
npm install @cofhe/react @cofhe/sdk
# or
pnpm add @cofhe/react @cofhe/sdk
```

## Quick Start

### 1. Wrap your app with CofheProvider

```tsx
import { CofheProvider } from '@cofhe/react';
import { createCofheClient } from '@cofhe/sdk/web';

const cofheClient = createCofheClient(config);

function App() {
  return (
    <CofheProvider cofheClient={cofheClient}>
      <YourApp />
    </CofheProvider>
  );
}
```

### Hooks-only usage

If you only want hooks/providers and do not want package CSS or UI components, import from the root package only:

```tsx
import { CofheProvider, useCofheClient } from '@cofhe/react';

function App() {
  return (
    <CofheProvider config={config}>
      <YourHookDrivenApp />
    </CofheProvider>
  );
}
```

If you do want the styled React UI components, import them from `@cofhe/react/ui`:

```tsx
import { CofheProvider } from '@cofhe/react';
import { CofheFloatingButtonWithProvider } from '@cofhe/react/ui';

function App() {
  return (
    <CofheProvider config={config}>
      <YourApp />
      <CofheFloatingButtonWithProvider />
    </CofheProvider>
  );
}
```

The `@cofhe/react/ui` entrypoint includes the package styles automatically.

### 2. Use the CofheEncryptInput component

```tsx
import { FheTypesList } from '@cofhe/react';
import { CofheEncryptInput } from '@cofhe/react/ui';

function MyComponent({ contractAddress }: { contractAddress: string }) {
  return (
    <CofheEncryptInput
      consumingContract={contractAddress} // The contract that will receive the encrypted value
      placeholder="Enter value to encrypt..."
      options={FheTypesList} // Pre-defined FHE types
      showProgressBar={true}
      onEncryptComplete={(data) => console.log('Encrypted:', data)}
      onEncryptError={(error) => console.error('Error:', error)}
    />
  );
}
```

### 3. Use the hook directly for custom implementations

```tsx
import { useCofheEncrypt } from '@cofhe/react';
import { Encryptable } from '@cofhe/sdk';

function CustomComponent({ contractAddress }: { contractAddress: string }) {
  const { encryptInputsAsync, isEncrypting } = useCofheEncrypt();

  const handleEncrypt = async () => {
    try {
      // One handle per item, followed by the signature for the whole batch
      const result = await encryptInputsAsync({
        items: [Encryptable.uint32(42n)],
        consumingContract: contractAddress,
      });
      console.log('Encrypted:', result);
    } catch (error) {
      console.error('Encryption failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleEncrypt} disabled={isEncrypting}>
        {isEncrypting ? 'Encrypting...' : 'Encrypt Value'}
      </button>
    </div>
  );
}
```

## Wallet selection

CoFHE signs with whatever `walletClient` the app supplies to `CofheProvider`
(or `connect()`). It does not read `window.ethereum` or pick a wallet itself —
the signing wallet is whichever provider your connector bound to. So when a user
has multiple injected wallets installed, disambiguation is a connector-layer
concern in your app, not something the SDK resolves.

To let users pick a wallet, use [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963)
discovery instead of the generic injected provider (`window.ethereum`). With
wagmi, every discovered wallet is a connector, so list `useConnectors()` and let
the user choose. The signer then follows the wallet they connected. See
[`examples/react`](https://github.com/FhenixProtocol/cofhesdk/blob/master/examples/react/src/components/Navigation.tsx) for a
working connect menu.

## CofheEncryptInput Component

Advanced input component with integrated features:

### Features

- ✅ **Type Selection Dropdown** - Choose from uint8, uint16, uint32, uint64, uint128, bool, address
- ✅ **Real-time Input Validation** - Validates input against selected FHE type
- ✅ **Progress Tracking** - Shows encryption steps with progress bar
- ✅ **Copy to Clipboard** - Copy encrypted results with one click
- ✅ **Bundled Iconography** - Consistent icons with no extra consumer install
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **Dark Mode Support** - Automatic dark/light theme support
- ✅ **TypeScript Support** - Full type safety

### Props

```tsx
interface CofheEncryptInputProps {
  consumingContract: string; // Required: the contract that will consume the encrypted value
  placeholder?: string;
  initialValue?: string;
  options?: FheTypeOption[]; // Use FheTypesList or custom options
  size?: 'sm' | 'md' | 'lg';
  hasError?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  showProgressBar?: boolean;
  debounceMs?: number;
  onTextChange?: (value: string) => void;
  onTypeChange?: (value: string) => void;
  onEncryptStart?: (data: EncryptionStartData) => void;
  onEncryptProgress?: (data: EncryptionProgressData) => void;
  onEncryptComplete?: (data: EncryptionResultData) => void;
  onEncryptError?: (error: string) => void;
  className?: string;
  testId?: string;
}
```

## useCofheEncrypt Hook

Mutation hook for custom encryption workflows. Next to the React Query mutation result it returns:

```tsx
const {
  encryptInputsAsync, // (variables) => Promise<[...hashes, signature]>
  encryptInputs, // (variables) => void - fire-and-forget, read the result from `data` / `error`
  isEncrypting, // boolean - encryption in progress
  stepsState, // stepsState.lastStep - the latest encryption step
} = useCofheEncrypt();
```

The variables are `{ items, consumingContract, account?, chainId?, securityZone?, onStepChange? }`. `consumingContract` is required: the verifier binds it into the signature, so the batch can only be consumed by that contract.

## Styling

The root `@cofhe/react` entrypoint is headless and does not load package styles.

If you import components from `@cofhe/react/ui`, the package styles are loaded automatically.

## Maintainer Notes

- Query invalidation context and block-hash-aware refetching: [INVALIDATION_CONTEXT.md](./INVALIDATION_CONTEXT.md)

## Dependencies

### Required Peer Dependencies

- `react` ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
- `react-dom` ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
- `viem` ^2.38.6

### CoFHE SDK Dependencies

- `@cofhe/sdk/web` - Web-specific CoFHE SDK
- `@cofhe/sdk/adapters` - Provider adapters
- `@cofhe/sdk/chains` - Chain configurations

## Example

See the complete example application in the `/example` directory of this repository for interactive demonstrations of all features.
