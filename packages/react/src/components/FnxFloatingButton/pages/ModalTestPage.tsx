import { TbX } from 'react-icons/tb';
import type { FnxModalInjectedProps } from '../types';

export const ModalTestPage: React.FC<FnxModalInjectedProps> = ({ onClose }) => {
  const handleSelect = () => {
    console.log('onSelect not implemented yet');
    onClose?.();
  };

  return (
    <div className="fnx-text-primary space-y-3">
      <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <TbX style={{ fontSize: 16 }} />
        <span>Close</span>
      </button>
      <div className="flex flex-col flex-1 gap-3">
        <p className="text-sm font-medium">Modal Test</p>
        <p className="text-xs">This is a modal that tests the modal functionality</p>
      </div>
      <div className="flex flex-row w-full items-center justify-center">
        <button onClick={onClose}>close</button>
        <button onClick={handleSelect}>select</button>
      </div>
    </div>
  );
};
