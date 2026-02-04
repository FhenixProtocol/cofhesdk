import CloseIcon from '@mui/icons-material/Close';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components';

type Props = {
  header: React.ReactNode | string;
  content: React.ReactNode;
  onClose: () => void;
};

export const BaseInfoModal: React.FC<Props> = ({ header, content, onClose }) => {
  return (
    <PageContainer
      isModal
      header={
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
        >
          <CloseIcon style={{ fontSize: 16 }} />
          {typeof header === 'string' ? (
            <p className="text-base font-semibold tracking-tight text-[#0E2F3F]">{header}</p>
          ) : (
            header
          )}
        </button>
      }
      content={<div className="flex flex-1 flex-col w-full gap-3 items-start justify-start">{content}</div>}
      footer={
        <div className="flex flex-row">
          <Button onClick={onClose}>
            <span>Close</span>
          </Button>
        </div>
      }
    />
  );
};
