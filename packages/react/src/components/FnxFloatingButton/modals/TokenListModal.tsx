import { PageContainer } from '../components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import type { Token } from '@/types/token';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TokenRow } from '../components/TokenRow';
import { useCofhePinnedTokenAddress } from '@/hooks/useCofhePinnedTokenAddress';
import type { BalanceType } from '../components/CofheTokenConfidentialBalance';
import { useState } from 'react';

import { AddCustomTokenButton } from './AddCustomTokenButton';
import { ImportCustomTokenCard } from './ImportCustomTokenCard';

export const TokenListModal: React.FC<PortalModalStateMap[PortalModal.TokenList]> = ({
  tokens,
  onClose,
  title,
  onSelectToken,
  balanceType,
}) => {
  const [isImportingToken, setIsImportingToken] = useState(false);

  return (
    <PageContainer
      header={
        <div className="flex justify-between flex-row">
          <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
            <ArrowBackIcon style={{ fontSize: 16 }} />
            <p className="text-sm font-medium">{title}</p>
          </button>
          <AddCustomTokenButton
            label={isImportingToken ? 'Close import' : 'Import token'}
            onClick={() => setIsImportingToken((value) => !value)}
          />
        </div>
      }
      content={
        <div className="flex flex-col gap-3">
          {isImportingToken && (
            <ImportCustomTokenCard
              balanceType={balanceType}
              tokens={tokens}
              onSelectToken={(token) => {
                onSelectToken(token);
                onClose();
              }}
            />
          )}
          <TokenListContent
            balanceType={balanceType}
            tokens={tokens}
            onSelectToken={(token) => {
              onSelectToken(token);
              onClose();
            }}
          />
        </div>
      }
    />
  );
};

export const TokenListContent: React.FC<{
  tokens: Token[];
  balanceType: BalanceType;
  onSelectToken: (token: Token) => void;
}> = ({ tokens, onSelectToken, balanceType }) => {
  const pinnedTokenAddress = useCofhePinnedTokenAddress();
  const normalizedPinnedAddress = pinnedTokenAddress?.toLowerCase();

  const pinnedToken = normalizedPinnedAddress
    ? tokens.find((t) => t.address.toLowerCase() === normalizedPinnedAddress)
    : undefined;

  const nonPinnedTokens = pinnedToken
    ? tokens.filter((t) => t.address.toLowerCase() !== normalizedPinnedAddress)
    : tokens;

  return (
    <div className="fnx-token-list-container">
      {tokens.length === 0 ? (
        <p className="text-xs opacity-70 py-4 text-center">No tokens found</p>
      ) : (
        <>
          {pinnedToken && (
            <TokenRow
              balanceType={balanceType}
              onClick={() => {
                onSelectToken(pinnedToken);
              }}
              key={`pinned-${pinnedToken.address}`}
              token={pinnedToken}
              topLabel="Pinned"
            />
          )}
          {nonPinnedTokens.map((token) => (
            <TokenRow
              balanceType={balanceType}
              onClick={() => {
                onSelectToken(token);
              }}
              key={token.address}
              token={token}
            />
          ))}
        </>
      )}
    </div>
  );
};
