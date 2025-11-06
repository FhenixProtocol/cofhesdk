import './App.css';
import { CofheProviderLocal } from './utils/cofhe.config';
import { QueryProvider } from './utils/query';
import { useEncrypt } from './hooks/useEncrypt';

function Inner() {
  const { data: encrypted, error, isLoading: isEncrypting } = useEncrypt('12345');
  console.log('Encrypted data:', encrypted);
  const rendered = {
    isEncrypting,
    error,
    encrypted,
  };
  return <pre>{JSON.stringify(rendered, null, 2)}</pre>;
}

function App() {
  return (
    <QueryProvider>
      <CofheProviderLocal>
        <Inner />
      </CofheProviderLocal>
    </QueryProvider>
  );
}

export default App;
