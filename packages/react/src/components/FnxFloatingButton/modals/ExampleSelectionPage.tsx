import { PortalModal, type PortalModalStateMap } from './types';
import CloseIcon from '@mui/icons-material/Close';
import { PageContainer } from '../components/PageContainer';

export const ExampleSelectionPage: React.FC<PortalModalStateMap[PortalModal.ExampleSelection]> = ({
  onClose,
  onSelect,
}) => {
  const options = ['1', '2', '3'];

  return (
    <PageContainer
      header={
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <CloseIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">Select an option</p>
        </button>
      }
      footer={
        <div className="flex flex-row flex-1 justify-end items-center mt-auto">
          <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
            <span>Close</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-3 items-start justify-start">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => {
              onSelect(option);
              onClose();
            }}
          >
            Option {option}
          </button>
        ))}
      </div>
    </PageContainer>
  );
};
