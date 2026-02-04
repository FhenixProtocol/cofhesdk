import PermitIcon from '@/assets/fhenix-permit-icon.svg';
import type { PortalModal, PortalModalStateMap } from './types';
import { BaseInfoModal } from './BaseInfoModal';

export const PermitInfoModal: React.FC<PortalModalStateMap[PortalModal.PermitInfo]> = ({ onClose }) => {
  return (
    <BaseInfoModal
      header="Permit"
      content={
        <>
          <div className="flex flex-col w-full justify-center items-center gap-3 text-[#0E2F3F] dark:text-white">
            <PermitIcon className="h-7 w-7 fill-black dark:fill-white" aria-label="CoFHE permit icon" />
            <div className="text-lg font-semibold">CoFHE Permits</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            CoFHE permits are used to authenticate your identity and grant access to your encrypted data.
          </p>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            Generating a permit requires a signature, which will open your connected wallet to sign a message (EIP712).
            This signed message contains only info used to authenticate and grant access.
          </p>
        </>
      }
      onClose={onClose}
    />
  );
};
