import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext, FNX_DEFAULT_TOAST_DURATION } from '../FnxFloatingButtonContext.js';
import { ToastPrimitive, ToastPrimitiveBase } from '../components/ToastPrimitives.js';

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
            addToast(
              <ToastPrimitiveBase>
                <div>Custom content</div>
              </ToastPrimitiveBase>
            );
          }}
        >
          Custom content toast
        </button>
        <button
          onClick={() => {
            addToast(
              {
                variant: 'info',
                title: "This toast won't go away on its own",
                description: 'Click the X to dismiss it',
              },
              'infinite'
            );
          }}
        >
          Non-expiring Toast
        </button>
        <button
          onClick={() => {
            addToast(
              {
                variant: 'warning',
                title: 'Warning toast',
                description: 'Take the action',
                action: {
                  label: 'ACTION',
                  onClick: () => {
                    alert('Action taken');
                  },
                },
              },
              'infinite'
            );
          }}
        >
          Toast with Action
        </button>
        <button
          onClick={() => {
            addToast(
              <ToastPrimitive
                variant="info"
                title="Info toast"
                description="Triggered with component"
                transaction={{ hash: '0x123', chainId: 1 }}
              />
            );
          }}
        >
          Info Toast (via component)
        </button>
        <button
          onClick={() => {
            addToast(
              <ToastPrimitive
                variant="success"
                title="Success toast"
                description="Triggered with component"
                transaction={{ hash: '0x123', chainId: 1 }}
              />
            );
          }}
        >
          Success Toast (via component)
        </button>
        <button
          onClick={() => {
            addToast(
              <ToastPrimitive
                variant="error"
                title="Error toast"
                description="Triggered with component"
                transaction={{ hash: '0x123', chainId: 1 }}
              />
            );
          }}
        >
          Error Toast (via component)
        </button>
        <button
          onClick={() => {
            addToast(
              <ToastPrimitive
                variant="warning"
                title="Warning toast"
                description="Triggered with component"
                transaction={{ hash: '0x123', chainId: 1 }}
              />
            );
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
        <button
          onClick={() => {
            addToast({
              variant: 'error',
              title: 'Permit invalid',
              description: 'Unable to decrypt data with this permit',
              action: {
                label: 'OPEN PERMITS',
                onClick: () => {
                  alert('open permits');
                },
              },
            });
          }}
        >
          Invalid Permit
        </button>
        <button
          onClick={() => {
            addToast({
              variant: 'success',
              title: 'Permit created successfully',
            });
          }}
        >
          Permit created
        </button>
      </div>
    </div>
  );
};

/**
 * <ToastBase
 *  variant='success'
 *  content={</....>}
 *  actions={</....>}
 * />
 *
 *
 * ToastSuccess
 * ToastError
 * ToastWarning
 * ToastInfo
 *
 * props: content, actions
 *
 *
 */
