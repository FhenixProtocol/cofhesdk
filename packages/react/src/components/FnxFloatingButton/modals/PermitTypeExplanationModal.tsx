import CloseIcon from '@mui/icons-material/Close';
import type { PortalModal, PortalModalStateMap } from './types';
import { PageContainer } from '../components/PageContainer';
import type { PermitType } from '@cofhe/sdk/permits';

const PermitTypeLabel: Record<PermitType, string> = {
  self: 'Self',
  sharing: 'Delegated',
  recipient: 'Imported',
};

export const PermitTypeExplanationModal: React.FC<PortalModalStateMap[PortalModal.PermitTypeExplanation]> = ({
  type,
  onClose,
}) => {
  return (
    <PageContainer
      isModal
      header={
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <CloseIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">{PermitTypeLabel[type]} Permit</p>
        </button>
      }
      content={
        <div className="flex flex-1 flex-col gap-3 items-start justify-start">
          {/* TODO: Improve copy */}
          {type === 'self' && (
            <p>
              "Self" permits are created by a user to access their own encrypted data. The provided signature is
              verified on-chain by the ACL (Access Control List).
            </p>
          )}
          {/* TODO: Improve copy */}
          {type === 'sharing' && (
            <p>
              "Delegated" permits are created by a user (Issuer) to share their encrypted data with another user
              (Recipient). Both Issuer and Rceipient must sign as a handshake. Issuer's signature is verified on-chain
              by the ACL (Access Control List) and grants access to Recipient, and Recipient's signature applies and
              verifies the re-encryption key.
            </p>
          )}
          {/* TODO: Improve copy */}
          {type === 'recipient' && (
            <p>
              "Imported" permits are imported by a user (Recipient) to access encrypted data that has been shared with
              them by the permit's Issuer. Both Issuer and Rceipient must sign as a handshake. Issuer's signature is
              verified on-chain by the ACL (Access Control List) and grants access to Recipient, and Recipient's
              signature applies and verifies the re-encryption key.
            </p>
          )}
        </div>
      }
      footer={
        <div className="flex flex-row">
          <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
            <span>Close</span>
          </button>
        </div>
      }
    />
  );
};
