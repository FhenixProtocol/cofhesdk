import { WalletHeader } from './MainPage/WalletHeader';
import { AssetCard } from './MainPage/AssetCard';
import { BottomNavigation } from './MainPage/BottomNavigation';
import { PageContainer } from '../components/PageContainer';
import { useCofheConnection } from '@/hooks';

/**
 * @internal Demo component for now, used internally; not a supported API. Undocumented and may change in any
 * release.
 */
export const MainPage: React.FC = () => {
  const { connected } = useCofheConnection();

  return (
    <PageContainer
      header={connected ? <WalletHeader /> : undefined}
      content={<AssetCard />}
      footer={connected ? <BottomNavigation /> : undefined}
    />
  );
};
