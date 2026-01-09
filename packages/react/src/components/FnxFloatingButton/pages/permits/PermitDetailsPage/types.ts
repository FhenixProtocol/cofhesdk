import type { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';

export type PermitDetailsPageProps = {
  selectedPermitHash: string;
};

declare module '../../../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.PermitDetails]: PermitDetailsPageProps;
  }
}
