import { useTokens } from '../hooks/useTokenLists';
import { useCofheContext } from '../providers';

export const FloatingCofhePortal: React.FC = () => {
  const widgetConfig = useCofheContext().widgetConfig;
  // todo wait for PR to merge https://github.com/FhenixProtocol/cofhesdk/pull/46 to access reactive chain id from useCofheConnection
  const tokens = useTokens(11155111);

  return (
    <div
      style={{
        textAlign: 'left',
        fontSize: 10,
        position: 'fixed',
        bottom: 20,
        right: 20,
        backgroundColor: 'white',
        zIndex: 1000,
        border: '1px solid #ccc',
      }}
    >
      <div>portal config:</div>
      <pre>{JSON.stringify(widgetConfig, null, 2)}</pre>
      <div>loaded tokens:</div>
      <pre>{JSON.stringify(tokens, null, 2)}</pre>
    </div>
  );
};
