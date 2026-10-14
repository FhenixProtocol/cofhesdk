import { ExampleSelectionPage } from './ExampleSelectionPage';
import { ExampleInfoPage } from './ExampleInfoPage';
import { PortalModal, type PortalModalStateMap } from './types';
import { ACPDetailsModal } from './ACPDetailsModal';
import { ACPTypeInfoModal } from './ACPTypeInfoModal';
import { ACPInfoModal } from './ACPInfoModal';
import { TokenListModal } from './TokenListModal';
import { ImportCustomTokenModal } from './ImportCustomTokenModal';

export const modals: { [M in PortalModal]: React.FC<PortalModalStateMap[M]> } = {
  [PortalModal.ExampleSelection]: ExampleSelectionPage,
  [PortalModal.ExampleInfo]: ExampleInfoPage,
  [PortalModal.ACPDetails]: ACPDetailsModal,
  [PortalModal.ACPTypeInfo]: ACPTypeInfoModal,
  [PortalModal.ACPInfo]: ACPInfoModal,
  [PortalModal.TokenList]: TokenListModal,
  [PortalModal.ImportCustomToken]: ImportCustomTokenModal,
};
