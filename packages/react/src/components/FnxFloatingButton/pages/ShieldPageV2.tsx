import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';

/**
 * Shield Page V2 - Placeholder for A/B testing
 * Replace this implementation with Option 2 design
 */
export const ShieldPageV2: React.FC = () => {
  const { navigateBack } = useFnxFloatingButtonContext();

  return (
    <div className="fnx-text-primary space-y-3">
      {/* Back Button */}
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">Shield (V2)</p>
      </button>

      <div className="text-center py-8">
        <p className="text-sm opacity-70">Option 2 - Coming Soon</p>
        <p className="text-xs opacity-50 mt-2">This is a placeholder for the alternative shield page design.</p>
      </div>
    </div>
  );
};
