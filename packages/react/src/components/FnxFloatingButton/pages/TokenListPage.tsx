import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface TokenListPageProps {
  onBack: () => void;
  darkMode: boolean;
}

export const TokenListPage: React.FC<TokenListPageProps> = ({ onBack, darkMode }) => {
  return (
    <div className={`space-y-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <p className="text-sm font-medium">Token List</p>
      <p className="text-xs">Token 1</p>
      <p className="text-xs">Token 2</p>
      <p className="text-xs">Token 3</p>
    </div>
  );
};

