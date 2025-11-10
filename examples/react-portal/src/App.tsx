import './App.css';
import { CofheProviderLocal } from './utils/cofhe.config';
import { QueryProvider } from './utils/query';
import { useEncrypt } from './hooks/useEncrypt';
import { Providers as WagmiProviders } from './utils/wagmi';
import { Wallet } from './components/Wallet';

function Inner() {
  const { data: encrypted, error, isLoading: isEncrypting, refetch } = useEncrypt('12345', { enabled: false });
  // console.log('Encrypted data:', encrypted);
  const rendered = {
    isEncrypting,
    error,
    encrypted: encrypted?.toString(),
  };

  return (
    <div>
      <button onClick={() => refetch()}>refetch</button>
      <pre>{JSON.stringify(rendered, null, 2)}</pre>
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
