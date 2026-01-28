import CloseIcon from '@mui/icons-material/Close';
import type { PortalModal, PortalModalStateMap } from './types';
import { PageContainer } from '../components/PageContainer';

export const ExampleInfoPage: React.FC<PortalModalStateMap[PortalModal.ExampleInfo]> = ({ onClose }) => {
  return (
    <PageContainer
      header={
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <CloseIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">More info</p>
        </button>
      }
      content={
        <div className="flex flex-1 flex-col gap-3 items-start justify-start">
          <p>Cofhesdk is complex, so we have created this modal to help you understand.</p>
          <p>
            You probably clicked on a ? button next to some functionality. And in this modal you'll get your information
            or explanation.
          </p>
          <p>This is another paragraph of explanation.</p>
          <p>Now that you're done reading, you can click "Got It" at the bottom to close this modal.</p>
        </div>
      }
      footer={
        <div className="flex flex-row flex-1 justify-end items-center mt-auto">
          <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
            <span>Got It</span>
          </button>
        </div>
      }
    />
  );
};
