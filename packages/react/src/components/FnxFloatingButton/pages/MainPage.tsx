import { WalletHeader } from './MainPage/WalletHeader';
import { AssetCard } from './MainPage/AssetCard';
import { BottomNavigation } from './MainPage/BottomNavigation';
import { PageContainer } from '../components/PageContainer';

export const MainPage: React.FC = () => (
  <PageContainer header={<WalletHeader />} footer={<BottomNavigation />}>
    <AssetCard />
  </PageContainer>
);
