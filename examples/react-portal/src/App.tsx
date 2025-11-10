import './App.css';
import { CofheProviderLocal } from './utils/cofhe.config';
import { QueryProvider } from './utils/query';
import { useEncrypt } from './hooks/useEncrypt';
import { Providers as WagmiProviders } from './utils/wagmi';
import { Wallet } from './components/Wallet';

function Inner() {
  const {
    queryResult: { data: encrypted, error, isFetching: isEncrypting, refetch: runEncryption },
    lastStep,
    compactSteps,
    // rawStreps,
  } = useEncrypt('12345', 'uint128', {
    enabled: false, // only run on explicit refetch, a callback fn call
  });
  // console.log('Encrypted data:', encrypted);
  const rendered = {
    isEncrypting,
    error,
    // tiny one-liner replacer to make BigInt visible in the browser
    encrypted: JSON.stringify(encrypted, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v)),
  };

  return (
    <div
      style={{
        textAlign: 'left',
      }}
    >
      <button onClick={() => runEncryption()}>refetch</button>
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
