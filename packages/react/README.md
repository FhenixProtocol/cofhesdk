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

const client = createCofheClient(config);

function App() {
  return (
    <CofheProvider client={client}>
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

function MyComponent() {
  return (
    <CofheEncryptInput
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
import { useEncryptInput } from '@cofhe/react';

function CustomComponent() {
  const { onEncryptInput, isEncryptingInput, encryptionProgress } = useEncryptInput();

  const handleEncrypt = async () => {
    try {
      const result = await onEncryptInput('uint32', '42');
      console.log('Encrypted:', result);
    } catch (error) {
      console.error('Encryption failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleEncrypt} disabled={isEncryptingInput}>
        {isEncryptingInput ? `Encrypting... ${encryptionProgress}%` : 'Encrypt Value'}
      </button>
    </div>
  );
}
```

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

## useEncryptInput Hook

Hook for custom encryption workflows with progress tracking:

```tsx
const {
  onEncryptInput, // (type, value) => Promise<encrypted>
  isEncryptingInput, // boolean - encryption in progress
  encryptionStep, // Current step: 'fetchKeys' | 'pack' | 'prove' | 'verify' | 'done'
  encryptionProgress, // Progress percentage (0-100)
  encryptionProgressLabel, // Human-readable progress label
  inputEncryptionDisabled, // boolean - whether encryption is disabled
} = useEncryptInput();
```

## Styling

The root `@cofhe/react` entrypoint is headless and does not load package styles.

If you import components from `@cofhe/react/ui`, the package styles are loaded automatically.

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
