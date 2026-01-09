import type { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/simpleTypes';

export type PermitDetailsPageProps = {
  selectedPermitHash: string;
};

declare module '../../../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.PermitDetails]: PermitDetailsPageProps;
  }
}
