import type { PortalModal, PortalModalStateMap } from './types';
import type { ACPType } from '@cofhe/sdk/acps';
import { BaseInfoModal } from './BaseInfoModal';

const ACPTypeLabel: Record<ACPType, string> = {
  self: 'Self',
  sharing: 'Delegated',
  recipient: 'Imported',
};

export const ACPTypeInfoModal: React.FC<PortalModalStateMap[PortalModal.ACPTypeInfo]> = ({ type, onClose }) => {
  return (
    <BaseInfoModal
      header={`${ACPTypeLabel[type]} ACP`}
      content={
        <>
          {/* TODO: Improve copy */}
          {type === 'self' && (
            <p>
              "Self" acps are created by a user to access their own encrypted data. The provided signature is
              verified on-chain by the ACL (Access Control List).
            </p>
          )}
          {/* TODO: Improve copy */}
          {type === 'sharing' && (
            <p>
              "Delegated" acps are created by a user (Issuer) to share their encrypted data with another user
              (Recipient). Both Issuer and Rceipient must sign as a handshake. Issuer's signature is verified on-chain
              by the ACL (Access Control List) and grants access to Recipient, and Recipient's signature applies and
              verifies the re-encryption key.
            </p>
          )}
          {/* TODO: Improve copy */}
          {type === 'recipient' && (
            <p>
              "Imported" acps are imported by a user (Recipient) to access encrypted data that has been shared with
              them by the acp's Issuer. Both Issuer and Rceipient must sign as a handshake. Issuer's signature is
              verified on-chain by the ACL (Access Control List) and grants access to Recipient, and Recipient's
              signature applies and verifies the re-encryption key.
            </p>
          )}
        </>
      }
      onClose={onClose}
    />
  );
};
