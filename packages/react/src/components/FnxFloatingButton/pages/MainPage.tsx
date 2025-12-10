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
    </div>
  );
};
