import { useCofheContext } from '../providers';

export const FloatingCofhePortal: React.FC = () => {
  const widgetConfig = useCofheContext().widgetConfig;

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
    </div>
  );
};
