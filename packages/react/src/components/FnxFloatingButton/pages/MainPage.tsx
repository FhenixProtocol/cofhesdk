interface MainPageProps {
  onNavigateToTokenList: () => void;
  darkMode: boolean;
}

export const MainPage: React.FC<MainPageProps> = ({ onNavigateToTokenList, darkMode }) => {
  return (
    <div className={`space-y-3 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      <p className="text-sm font-medium">Main Menu</p>
      <button
        onClick={onNavigateToTokenList}
        className="w-full px-3 py-2 text-sm rounded border border-current hover:bg-gray-100 hover:bg-opacity-10 transition-colors"
      >
        View Token List
      </button>
    </div>
  );
};

