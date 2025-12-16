import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { FNX_DEFAULT_TOAST_DURATION, ToastPrimitive } from '../components/ToastPrimitives.js';

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
            addToast({
              duration: 'infinite',
              variant: 'info',
              title: "This toast won't go away on its own",
              description: 'Click the X to dismiss it',
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
                onClick: () => {
                  alert('Action taken');
                },
              },
            });
          }}
        >
          Toast with Action
        </button>
        <button
          onClick={() => {
            addToast({
              content: (
                <ToastPrimitive
                  duration={FNX_DEFAULT_TOAST_DURATION}
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
            addToast({
              content: (
                <ToastPrimitive
                  duration={FNX_DEFAULT_TOAST_DURATION}
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
            addToast({
              content: (
                <ToastPrimitive
                  duration={FNX_DEFAULT_TOAST_DURATION}
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
            addToast({
              content: (
                <ToastPrimitive
                  duration={FNX_DEFAULT_TOAST_DURATION}
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
              duration: FNX_DEFAULT_TOAST_DURATION,
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
              duration: FNX_DEFAULT_TOAST_DURATION,
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
              duration: FNX_DEFAULT_TOAST_DURATION,
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
              duration: FNX_DEFAULT_TOAST_DURATION,
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
