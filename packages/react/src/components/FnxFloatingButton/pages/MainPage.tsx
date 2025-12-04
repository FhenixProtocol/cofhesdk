import { WalletHeader } from './MainPage/WalletHeader.js';
import { AssetCard } from './MainPage/AssetCard.js';
import { BottomNavigation } from './MainPage/BottomNavigation.js';
import { FloatingButtonPage, useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';

export const MainPage: React.FC = () => {
  const { navigateTo } = useFnxFloatingButtonContext();
  return (
    <div className="fnx-text-primary fnx-main-page">
      <WalletHeader />
      <AssetCard />
      <BottomNavigation />
      <button
        onClick={() => navigateTo(FloatingButtonPage.Permits)}
        className="w-full px-3 py-2 text-sm rounded border border-current hover:bg-gray-100 hover:bg-opacity-10 transition-colors"
      >
        View Permits
      </button>
    </div>
  );
};
