import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';

export const DebugPage: React.FC = () => {
  const { navigateBack, addToast } = useFnxFloatingButtonContext();

  return (
    <div className="fnx-text-primary space-y-3">
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <p className="text-sm font-medium">Debug</p>
      <p className="text-xs">Toasts:</p>
      <button onClick={() => addToast({ id: '1', duration: 3000, content: <div>Hello, world!</div> })}>
        Add Toast
      </button>
    </div>
  );
};
