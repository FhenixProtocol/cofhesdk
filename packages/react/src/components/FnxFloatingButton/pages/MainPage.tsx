import { WalletHeader } from './MainPage/WalletHeader';
import { AssetCard } from './MainPage/AssetCard';
import { BottomNavigation } from './MainPage/BottomNavigation';

export const MainPage: React.FC = () => (
  <div className="fnx-text-primary w-full">
    <WalletHeader />
    <AssetCard />
    <BottomNavigation />
  </div>
);
