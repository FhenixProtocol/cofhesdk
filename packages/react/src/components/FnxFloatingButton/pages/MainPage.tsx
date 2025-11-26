import { WalletHeader } from './MainPage/WalletHeader.js';
import { AssetCard } from './MainPage/AssetCard.js';
import { BottomNavigation } from './MainPage/BottomNavigation.js';

export const MainPage: React.FC = () => {
  return (
    <div className="fnx-text-primary fnx-main-page">
      <WalletHeader />
      <AssetCard />
      <BottomNavigation />
    </div>
  );
};

