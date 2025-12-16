import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import {
  ToastPrimitive,
} from '../components/ToastPrimitives.js';

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
            addToast({
              id,
              content: (
                <ToastPrimitive
                  id={id}
                  variant="info"
                  title="This toast won't go away on its own"
                  description="Click the X to dismiss it"
                />
              ),
            });
          }}
        >
          Non-expiring Toast
        </button>
        <button
          onClick={() => {
            addToast({
              variant: 'warning',
              duration: 'infinite',
              title: 'Warning toast',
              description: 'Take the action',
              action: {
                label: 'ACTION',
                onClick: (onClose) => {
                  alert('Action taken');
                  onClose();
                },
              },
            });
          }}
        >
          Toast with Action
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <ToastPrimitive
                  id={id}
                  variant="info"
                  title="Info toast"
                  description="Triggered with component"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Info Toast (via component)
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <ToastPrimitive
                  id={id}
                  variant="success"
                  title="Success toast"
                  description="Triggered with component"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Success Toast (via component)
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <ToastPrimitive
                  id={id}
                  variant="error"
                  title="Error toast"
                  description="Triggered with component"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Error Toast (via component)
        </button>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            addToast({
              id,
              duration: 3000,
              content: (
                <ToastPrimitive
                  id={id}
                  variant="warning"
                  title="Warning toast"
                  description="Triggered with component"
                  transaction={{ hash: '0x123', chainId: 1 }}
                />
              ),
            });
          }}
        >
          Warning Toast (via component)
        </button>
        <button
          onClick={() => {
            addToast({
              variant: 'info',
              title: 'Info toast',
              description: 'Triggered by function',
              transaction: { hash: '0x123', chainId: 1 },
            });
          }}
        >
          Info Toast (via function)
        </button>
        <button
          onClick={() => {
            addToast({
              variant: 'success',
              title: 'Success toast',
              description: 'Triggered by function',
              transaction: { hash: '0x123', chainId: 1 },
            });
          }}
        >
          Success Toast (via function)
        </button>
        <button
          onClick={() => {
            addToast({
              variant: 'error',
              title: 'Error toast',
              description: 'Triggered by function',
              transaction: { hash: '0x123', chainId: 1 },
            });
          }}
        >
          Error Toast (via function)
        </button>
        <button
          onClick={() => {
            addToast({
              variant: 'warning',
              title: 'Warning toast',
              description: 'Triggered by function',
              transaction: { hash: '0x123', chainId: 1 },
            });
          }}
        >
          Warning Toast (via function)
        </button>
      </div>
    </div>
  );
};
