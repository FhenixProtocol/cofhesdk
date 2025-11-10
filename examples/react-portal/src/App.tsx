import './App.css';
import { CofheProviderLocal } from './utils/cofhe.config';
import { QueryProvider } from './utils/query';
import { useEncryptFromCallbackArgs, useEncryptFromHookArgs } from './hooks/useEncrypt';
import { Providers as WagmiProviders } from './utils/wagmi';
import { Wallet } from './components/Wallet';
import { useState } from 'react';

function Inner() {
  const [value, setValue] = useState('12345');
  const {
    // // mutation: { variables, error, isPending: isEncrypting, data: encrypted, mutateAsync: mutateAsyncArgsFromHook },
    // stepsState: { lastStep, compactSteps },
    // api: { variables, error, isEncrypting, data: encrypted, mutateAsync: mutateAsyncFromHook },
  } = useEncryptFromHookArgs(value, 'uint128');

  const {
    // // mutation: { variables, error, isPending: isEncrypting, data: encrypted, mutateAsync: mutateAsyncArgsFromCallback },
    stepsState: { lastStep, compactSteps },
    api: { variables, error, isEncrypting, data: encrypted, mutateAsync: mutateAsyncArgsFromCallback },
  } = useEncryptFromCallbackArgs();

  // const { encryptValueCall, stepsState } = useEncryptValueCall();
  // if (error) console.error('Debug Encrypted data:', error);
  // console.log('Encrypted data:', encrypted);

  async function tmp() {
    try {
      const result = await mutateAsyncArgsFromCallback({
        value,
        type: 'uint128',
      });
      // const result = await mutateAsyncFromHook();
    } catch (e) {
      console.error('Error during encryption:', e);
    }
  }

  const rendered = {
    isEncrypting,
    error: error ? error.message : null,
    // tiny one-liner replacer to make BigInt visible in the browser
    // encrypted: JSON.stringify(encrypted, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)),
    encrypted,
    variables,
  };

  return (
    <div
      style={{
        textAlign: 'left',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Value to encrypt:</label>
        <input value={value} onChange={(e) => setValue(e.target.value)} style={{ marginRight: 8 }} />
        <button onClick={() => tmp()}>Encrypt</button>
      </div>
      <pre>{JSON.stringify(rendered, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v), 2)}</pre>
      <pre>{JSON.stringify({ lastStep, compactSteps }, null, 2)}</pre>
    </div>
  );
}

function App() {
  return (
    <WagmiProviders>
      <QueryProvider>
        <CofheProviderLocal>
          <Wallet />
          <Inner />
        </CofheProviderLocal>
      </QueryProvider>
    </WagmiProviders>
  );
}

export default App;
