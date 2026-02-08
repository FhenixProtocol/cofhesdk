import { PageContainer } from '../components/PageContainer';
import type { FloatingButtonPage } from '../pagesConfig/types';

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.Portfolio]: void;
  }
}
export const PortfolioPage: React.FC = () => {
  return <PageContainer header={'header'} content={'content'} footer={'footer'} />;
};
