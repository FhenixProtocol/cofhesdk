import { PortalModal, type PortalModalPropsMapWithOnClose } from './types';
import CloseIcon from '@mui/icons-material/Close';

export const ExampleSelectionPage: React.FC<PortalModalPropsMapWithOnClose[PortalModal.ExampleSelection]> = ({
  onClose,
  onSelect,
}) => {
  const options = ['1', '2', '3'];

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Header */}
      <div className="flex flex-row flex-1 justify-between items-center">
        <p className="text-sm font-medium">Select an option</p>
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <CloseIcon style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Options */}
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
    </div>
  );
};
