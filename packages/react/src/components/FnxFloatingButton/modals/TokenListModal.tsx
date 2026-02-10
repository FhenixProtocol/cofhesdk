import { PageContainer } from '../components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { useCofheChainId } from '@/hooks/useCofheConnection';
import { type Token, useCofheTokens } from '@/hooks';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TokenRow } from '../components/TokenRow';
import { useCofhePinnedTokenAddress } from '@/hooks/useCofhePinnedTokenAddress';

export const TokenListModal: React.FC<PortalModalStateMap[PortalModal.TokenList]> = ({
  tokens,
  onClose,
  title,
  onSelectToken,
}) => {
  return (
    <PageContainer
      header={
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">{title}</p>
        </button>
      }
      content={
        <TokenListContent
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

export const TokenListContent: React.FC<{
  tokens: Token[];
  onSelectToken: (token: Token) => void;
}> = ({ tokens, onSelectToken }) => {
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
