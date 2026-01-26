import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ToastPrimitive, ToastPrimitiveBase } from '../components/ToastPrimitives.js';
import { useState } from 'react';
import { PortalModal } from '../modals/types';
import { usePortalNavigation, usePortalStatuses, usePortalModals, usePortalToasts } from '@/stores';
import { PageContainer } from '../components/PageContainer.js';
import { useCofheClient } from '@/hooks/useCofheClient.js';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

type Tab = 'modal' | 'status' | 'toast' | 'permit';

export const DebugPage: React.FC = () => {
  const { navigateBack } = usePortalNavigation();
  const { statuses, addStatus, removeStatus } = usePortalStatuses();
  const { addToast } = usePortalToasts();
  const { openModal } = usePortalModals();
  const [modalSelection, setModalSelection] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>('modal');

  return (
    <PageContainer
      header={
        <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <span>Back</span>
        </button>
      }
      content={
        <>
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
        </>
      }
    />
  );
};

const CreateSelfExpiringPermitButton = () => {
  const cofheClient = useCofheClient();

  const create = async () => {
    const { account } = cofheClient.getSnapshot();
    if (!account) throw new Error('No connected account found');
    const expiration = Math.floor(Date.now() / 1000) + 2 * 60;
    await cofheClient.permits.createSelf({
      name: `Exp ${expiration}`,
      issuer: account,
      expiration: expiration,
    });
  };

  return <button onClick={create}>Create self permit (expires in 2 minutes)</button>;
};

const CreateAndUseReceivingPermitButton = () => {
  const cofheClient = useCofheClient();

  const receiveAndUse = async () => {
    const { account, publicClient } = cofheClient.getSnapshot();
    if (!account) throw new Error('No connected account found');
    if (!publicClient) throw new Error('No public client found');

    // Create account to create the sharing permit from private key
    const sharingAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    const sharingWalletClient = createWalletClient({
      chain: publicClient!.chain,
      transport: http(),
      account: sharingAccount,
    });

    // Create a sharing permit with account {sharingAccount} and recipient {account}
    const sharedPermit = await cofheClient.permits.createSharing(
      {
        name: 'Sharing permit',
        issuer: sharingAccount.address,
        expiration: Math.floor(Date.now() / 1000) + 120 * 60,
        recipient: account,
      },
      {
        publicClient,
        walletClient: sharingWalletClient,
      }
    );

    // Receive shared permit
    await cofheClient.permits.importShared(sharedPermit);
  };

  return <button onClick={receiveAndUse}>Create and use receiving permit</button>;
};
