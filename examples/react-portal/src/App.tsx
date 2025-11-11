import './App.css';
import { CofheProviderLocal } from './utils/cofhe.config';
import { QueryProvider } from './utils/query';
import { useEncryptAsync } from './hooks/useEncrypt';
import { Providers as WagmiProviders } from './utils/wagmi';
import { Wallet } from './components/Wallet';
import { useState } from 'react';
import { FloatingCofhePortal } from '@cofhe/react';
function Inner() {
  const [value, setValue] = useState('12345');
  // const {
  //   // _mutation: { variables /* nb, those are variables of mutation fn, not of the encrypting query */,  error, isPending: isEncrypting, data: encrypted, mutateAsync: mutateAsyncFromHook },
  //   // stepsState: { lastStep, compactSteps },
  //   // api: { variables, error, isEncrypting, data: encrypted, mutateAsync: mutateAsyncFromHook },
  // } = useEncryptSync(
  //   { value, type: 'uint128' }
  //   // ,{
  //   //   onError: (err) => {
  //   //     console.error('Encryption error (from callback args):', err);
  //   //   },
  //   //   onSuccess: (data) => {
  //   //     console.log('Encryption success (from callback args):', data);
  //   //   },
  //   //   onMutate(variables, context) {
  //   //     console.log('Encryption started (from callback args):', { variables });
  //   //   },
  //   // }
  // );

  const {
    // mutation: { variables, error, isPending: isEncrypting, data: encrypted, mutateAsync: mutateAsyncArgsFromCallback },
    stepsState: { lastStep, compactSteps },
    api: { variables, error, isEncrypting, data: encrypted, encrypt: encryptAsync },
  } = useEncryptAsync();

  // const { encryptValueCall, stepsState } = useEncryptValueCall();
  // if (error) console.error('Debug Encrypted data:', error);
  // console.log('Encrypted data:', encrypted);

  async function tmp() {
    try {
      const result = await encryptAsync({
        value,
        type: 'uint128',
      });
      console.log('Encryption result (from called fn):', result);
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
          <FloatingCofhePortal />
          <Wallet />
          <Inner />
        </CofheProviderLocal>
      </QueryProvider>
    </WagmiProviders>
  );
}

export default App;
