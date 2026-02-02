import { ExampleSelectionPage } from './ExampleSelectionPage';
import { ExampleInfoPage } from './ExampleInfoPage';
import { PortalModal, type PortalModalStateMap } from './types';
import { PermitDetailsModal } from './PermitDetailsModal';
import { PermitTypeExplanationModal } from './PermitTypeExplanationModal';

export const modals: { [M in PortalModal]: React.FC<PortalModalStateMap[M]> } = {
  [PortalModal.ExampleSelection]: ExampleSelectionPage,
  [PortalModal.ExampleInfo]: ExampleInfoPage,
  [PortalModal.PermitDetails]: PermitDetailsModal,
  [PortalModal.PermitTypeExplanation]: PermitTypeExplanationModal,
};
