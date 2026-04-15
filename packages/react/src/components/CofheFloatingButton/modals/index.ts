import { ExampleSelectionPage } from './ExampleSelectionPage';
import { ExampleInfoPage } from './ExampleInfoPage';
import { PortalModal, type PortalModalStateMap } from './types';
import { PermitDetailsModal } from './PermitDetailsModal';
import { PermitTypeInfoModal } from './PermitTypeInfoModal';
import { PermitInfoModal } from './PermitInfoModal';
import { TokenListModal } from './TokenListModal';

export const modals: { [M in PortalModal]: React.FC<PortalModalStateMap[M]> } = {
  [PortalModal.ExampleSelection]: ExampleSelectionPage,
  [PortalModal.ExampleInfo]: ExampleInfoPage,
  [PortalModal.PermitDetails]: PermitDetailsModal,
  [PortalModal.PermitTypeInfo]: PermitTypeInfoModal,
  [PortalModal.PermitInfo]: PermitInfoModal,
  [PortalModal.TokenList]: TokenListModal,
};
