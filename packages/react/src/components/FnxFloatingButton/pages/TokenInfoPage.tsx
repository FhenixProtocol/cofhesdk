import { type Token } from '@/hooks/useCofheTokenLists';
import { FloatingButtonPage } from '../pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { TokenDetailsView } from '../components/TokenDetailsView';

type TokenInfoPageProps = {
  token: Token;
};

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.TokenInfo]: TokenInfoPageProps;
  }
}

export const TokenInfoPage: React.FC<TokenInfoPageProps> = ({ token }) => {
  const { navigateBack } = usePortalNavigation();

  return <TokenDetailsView token={token} onBack={navigateBack} />;
};
