import { PortalModal, type PortalModalStateMap } from '../pagesConfig/types';
import { ExampleSelectionPage } from './ExampleSelectionPage';
import { ExampleInfoPage } from './ExampleInfoPage';

export const modals: { [M in PortalModal]: React.FC<PortalModalStateMap[M]> } = {
  [PortalModal.ExampleSelection]: ExampleSelectionPage,
  [PortalModal.ExampleInfo]: ExampleInfoPage,
};
