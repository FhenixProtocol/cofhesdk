import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';

export const MainPage: React.FC = () => {
  const { navigateToTokenList } = useFnxFloatingButtonContext();

  return (
    <div className="fnx-text-primary space-y-3">
      <p className="text-sm font-medium">Main Menu</p>
      <button
        onClick={navigateToTokenList}
        className="w-full px-3 py-2 text-sm rounded border border-current hover:bg-gray-100 hover:bg-opacity-10 transition-colors"
      >
        View Token List
      </button>
    </div>
  );
};

