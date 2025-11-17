import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface SettingsPageProps {
  onBack: () => void;
  darkMode: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, darkMode }) => {
  return (
    <div className={`space-y-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <p className="text-sm font-medium">Settings</p>
      <p className="text-xs">Settings content goes here</p>
    </div>
  );
};

