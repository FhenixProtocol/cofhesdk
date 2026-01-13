import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { type Token } from '@/hooks/useCofheTokenLists';
import { TokenIcon } from '../components/TokenIcon';
import { AddressButton } from '../components/AddressButton';
import { CofheTokenConfidentialBalance } from '../components/CofheTokenConfidentialBalance';
import { FloatingButtonPage } from '../pagesConfig/types';
import { usePortalNavigation } from '@/stores';

type TokenInfoPageProps = {
  token: Token;
};

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.TokenInfo]: TokenInfoPageProps;
  }
}

export const TokenInfoPage: React.FC<TokenInfoPageProps> = ({ token }) => {
  const { navigateBack } = usePortalNavigation();

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Header */}
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>

      {/* Token Icon and Name */}
      <div className="flex flex-col items-center gap-3">
        <TokenIcon logoURI={token.logoURI} alt={token.name} size="xl" />
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-bold">{token.name}</h2>
          <p className="text-sm opacity-70">{token.symbol}</p>
        </div>
      </div>

      {/* Balance Section */}
      <div className="fnx-card-bg rounded-lg p-4 border fnx-card-border">
        <div className="flex flex-col gap-2">
          <p className="text-xs opacity-70">Balance</p>
          <CofheTokenConfidentialBalance token={token} size="xl" decimalPrecision={5} className="font-bold" />
        </div>
      </div>

      {/* Token Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Token Details</h3>

        {/* Address */}
        <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
          <div className="flex flex-col gap-2">
            <p className="text-xxxs opacity-70">Contract Address</p>
            <AddressButton address={token.address} className="w-full justify-start" />
          </div>
        </div>

        {/* Decimals */}
        <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
          <div className="flex items-center justify-between">
            <p className="text-xxxs opacity-70">Decimals</p>
            <p className="text-sm font-medium">{token.decimals}</p>
          </div>
        </div>

        {/* Confidentiality Type */}
        {token && (
          <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
            <div className="flex items-center justify-between">
              <p className="text-xxxs opacity-70">Confidentiality Type</p>
              <p className="text-sm font-medium capitalize">{token.extensions.fhenix.confidentialityType}</p>
            </div>
          </div>
        )}

        {/* Confidential Value Type */}
        {token && (
          <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
            <div className="flex items-center justify-between">
              <p className="text-xxxs opacity-70">Value Type</p>
              <p className="text-sm font-medium">{token.extensions.fhenix.confidentialValueType}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
