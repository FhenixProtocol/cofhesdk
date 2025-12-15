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
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Debug</p>
        <p className="text-xs">Toasts:</p>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            console.log('Adding toast with id:', id);
            addToast({ id, duration: 3000, content: <div>Hello, world! {id}</div> });
          }}
        >
          Add Toast
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            console.log('Adding toast with id:', id);
            addToast({ id, content: <div>Hello, world! (inf) {id}</div> });
          }}
        >
          Add Inf Toast
        </button>
      </div>
    </div>
  );
};
