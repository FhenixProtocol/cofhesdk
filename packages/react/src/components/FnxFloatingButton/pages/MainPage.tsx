import { WalletHeader } from './MainPage/WalletHeader';
import { AssetCard } from './MainPage/AssetCard';
import { BottomNavigation } from './MainPage/BottomNavigation';

export const MainPage: React.FC = () => {
  return (
    <div className="fnx-text-primary fnx-main-page">
      <WalletHeader />
      <AssetCard />
      <BottomNavigation />
    </div>
  );
};
