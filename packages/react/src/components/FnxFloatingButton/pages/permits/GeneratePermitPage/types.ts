import type { ReactNode } from 'react';

export type GeneratePermitPageProps = {
  onSuccessNavigateTo?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  overridingBody?: ReactNode;
};
