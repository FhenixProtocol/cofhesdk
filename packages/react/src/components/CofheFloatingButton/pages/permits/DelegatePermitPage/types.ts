import type { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types';

export type DelegatePermitPageProps = {
  onSuccessNavigateTo?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
};

declare module '../../../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.DelegatePermits]: DelegatePermitPageProps;
  }
}
