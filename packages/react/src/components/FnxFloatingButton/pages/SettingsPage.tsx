import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSettingsStore, ShieldPageVariant, SHIELD_PAGE_VARIANT_LABELS } from '../stores/settingsStore.js';
import { usePortalNavigation } from '@/stores';

export const SettingsPage: React.FC = () => {
  const { navigateBack } = usePortalNavigation();
  const { shieldPageVariant, setShieldPageVariant } = useSettingsStore();

  const variants = Object.values(ShieldPageVariant);

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Header */}
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Settings</span>
      </button>

      {/* A/B Testing Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium">A/B Testing</p>

        {/* Shield Page Variant */}
        <div className="space-y-2">
          <p className="text-xs opacity-70">Shield Page</p>
          <div className="space-y-1">
            {variants.map((variant) => (
              <label key={variant} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="shieldPageVariant"
                  checked={shieldPageVariant === variant}
                  onChange={() => setShieldPageVariant(variant)}
                />
                <span>{SHIELD_PAGE_VARIANT_LABELS[variant]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
