import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ToastPrimitive, ToastPrimitiveBase } from '../components/ToastPrimitives.js';
import { useState } from 'react';
import { PortalModal } from '../modals/types';
import { usePortalStore } from '@/stores/portalStore.js';

export const DebugPage: React.FC = () => {
  const { navigateBack, addToast, statuses, addStatus, removeStatus, openModal } = usePortalStore();
  const [modalSelection, setModalSelection] = useState<string | undefined>(undefined);

  return (
    <div className="fnx-text-primary space-y-3">
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Debug</p>
        <p className="text-xs">Modal:</p>
        <button
          onClick={() => {
            openModal(PortalModal.ExampleSelection, {
              onSelect: (selection: string) => {
                setModalSelection(selection);
              },
            });
          }}
        >
          Open selection modal: selection: {modalSelection}
        </button>
        <button
          onClick={() => {
            openModal(PortalModal.ExampleInfo);
          }}
        >
          Open info modal
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Debug</p>
        <p className="text-xs">Status:</p>
        <button
          onClick={() => {
            const isPresent = statuses.some((status) => status.id === 'test-warning-status');
            if (isPresent) {
              removeStatus('test-warning-status');
            } else {
              addStatus({
                id: 'test-warning-status',
                variant: 'warning',
                title: 'Warning status',
                description: 'This is a warning status',
              });
            }
          }}
        >
          "test-warning-status" (toggle)
        </button>
        <button
          onClick={() => {
            const isPresent = statuses.some((status) => status.id === 'test-error-status');
            if (isPresent) {
              removeStatus('test-error-status');
            } else {
              addStatus({
                id: 'test-error-status',
                variant: 'error',
                title: 'Error status',
                description: 'This is an error status',
              });
            }
          }}
        >
          "test-error-status" (toggle)
        </button>
        <button
          onClick={() => {
            addStatus({
              id: 'test-status-with-action',
              variant: 'warning',
              title: 'Warning status',
              action: {
                label: 'RESOLVE',
                onClick: () => {
                  removeStatus('test-status-with-action');
                },
              },
            });
          }}
        >
          "test-status-with-action" (open)
        </button>
      </div>

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
