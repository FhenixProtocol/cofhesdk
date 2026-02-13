import type { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import type { ReactNode } from 'react';

export type GeneratePermitPageProps = {
  onSuccessNavigateTo?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  cause?: 'clicked_on_confidential_balance';
};

declare module '../../../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.GeneratePermits]: GeneratePermitPageProps;
  }
}
