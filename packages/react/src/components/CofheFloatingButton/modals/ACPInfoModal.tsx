import ACPIcon from '@/assets/fhenix-acp-icon.svg';
import type { PortalModal, PortalModalStateMap } from './types';
import { BaseInfoModal } from './BaseInfoModal';

export const ACPInfoModal: React.FC<PortalModalStateMap[PortalModal.ACPInfo]> = ({ onClose }) => {
  return (
    <BaseInfoModal
      header="ACP"
      content={
        <>
          <div className="flex flex-col w-full justify-center items-center gap-3 text-[#0E2F3F] dark:text-white">
            <ACPIcon className="h-7 w-7 fill-black dark:fill-white" aria-label="CoFHE ACP icon" />
            <div className="text-lg font-semibold">CoFHE ACPs</div>
          </div>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            CoFHE ACPs are used to authenticate your identity and grant access to your encrypted data.
          </p>
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            Generating an ACP requires a signature, which will open your connected wallet to sign a message (EIP712).
            This signed message contains only info used to authenticate and grant access.
          </p>
        </>
      }
      onClose={onClose}
    />
  );
};
