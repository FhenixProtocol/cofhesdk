import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';

export const SendPage: React.FC = () => {
  const { navigateBack } = useFnxFloatingButtonContext();

  return (
    <div className="fnx-text-primary space-y-3">
      <button
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <p className="text-sm font-medium">Send</p>
      <p className="text-xs">Send content goes here</p>
    </div>
  );
};

