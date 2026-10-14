import type { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types';

export type DelegateACPPageProps = {
  onSuccessNavigateTo?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
};

declare module '../../../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.DelegateACPs]: DelegateACPPageProps;
  }
}
