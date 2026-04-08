import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { PageContainer } from '../components/PageContainer';
import { ImportCustomTokenCard } from './ImportCustomTokenCard';
import { PortalModal, type PortalModalStateMap } from './types';

export const ImportCustomTokenModal: React.FC<PortalModalStateMap[PortalModal.ImportCustomToken]> = ({
  tokens,
  onClose,
  title,
  onSelectToken,
  balanceType,
}) => {
  return (
    <PageContainer
      isModal
      header={
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">{title}</p>
        </button>
      }
      content={
        <ImportCustomTokenCard
          balanceType={balanceType}
          tokens={tokens}
          onSelectToken={(token) => {
            onSelectToken(token);
            onClose();
          }}
        />
      }
    />
  );
};
