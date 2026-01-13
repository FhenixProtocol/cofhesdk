import { ExampleSelectionPage } from './ExampleSelectionPage';
import { ExampleInfoPage } from './ExampleInfoPage';
import { PortalModal, type PortalModalStateMap } from './types';

export const modals: { [M in PortalModal]: React.FC<PortalModalStateMap[M]> } = {
  [PortalModal.ExampleSelection]: ExampleSelectionPage,
  [PortalModal.ExampleInfo]: ExampleInfoPage,
};
