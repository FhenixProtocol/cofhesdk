import { useCofheContext } from '../providers';

export const FloatingCofheButton: React.FC = () => {
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
      <div>widget config:</div>
      <pre>{JSON.stringify(widgetConfig, null, 2)}</pre>
    </div>
  );
};
