import './App.css';
import { CofheProviderLocal } from './utils/cofhe.config';
import { QueryProvider } from './utils/query';
import { useEncryptFromArgs, useEncryptValueViaCallback } from './hooks/useEncrypt';
import { Providers as WagmiProviders } from './utils/wagmi';
import { Wallet } from './components/Wallet';
import { useState } from 'react';

function Inner() {
  const [value, setValue] = useState('12345');
  const {
    // queryResult: { data: encrypted, error, isFetching: isEncrypting, refetch: refetchFromHookArgs },
    // stepsState: { lastStep, compactSteps },
    // rawStreps,
    // rawStreps,
  } = useEncryptFromArgs(value, 'uint128', {
    enabled: false, // only run on explicit refetch, a callback fn call
  });

  const {
    stepsState: { lastStep, compactSteps },
    // mutation: { mutateAsync: encryptValueCall, error: errorCall, isPending: isEncryptingCall, data: encryptedCall },
    mutation: { mutateAsync: encryptValueCall, error, isPending: isEncrypting, data: encrypted },
  } = useEncryptValueViaCallback();

  // const { encryptValueCall, stepsState } = useEncryptValueCall();
  if (error) console.error('Debug Encrypted data:', error);
  // console.log('Encrypted data:', encrypted);
  const rendered = {
    isEncrypting,
    error: error ? error.message : null,
    // tiny one-liner replacer to make BigInt visible in the browser
    encrypted: JSON.stringify(encrypted, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)),
  };

  async function tmp() {
    // this will always succeed as it's a call to refetch. Will contain 'error' if something went wrong
    // const result = await refetchFromHookArgs();

    // but this will throw if something goes wrong
    try {
      const encryptValueCallResult = await encryptValueCall({ value, type: 'uint128' });
    } catch (e) {
      console.error('Error during encryption via callback:', e);
      throw e;
    }
  }

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
