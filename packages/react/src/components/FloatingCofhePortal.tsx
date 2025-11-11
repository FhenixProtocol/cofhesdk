import { useCofheContext } from '../providers';

export const FloatingCofhePortal: React.FC = () => {
  const widgetConfig = useCofheContext().widgetConfig;

  return (
    <div style={{ textAlign: 'left' }}>
      <div>portal config:</div>
      <pre>{JSON.stringify(widgetConfig, null, 2)}</pre>
    </div>
  );
};
