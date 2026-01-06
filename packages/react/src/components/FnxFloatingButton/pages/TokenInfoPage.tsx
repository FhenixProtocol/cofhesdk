import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { useCofheToken } from '../../../hooks/useCofheTokenLists';
import { TokenIcon } from '../components/TokenIcon';
import { AddressButton } from '../components/AddressButton';
import { TokenBalance } from '../components/TokenBalance';

export const TokenInfoPage: React.FC = () => {
  const { navigateBack, viewingToken } = useFnxFloatingButtonContext();

  // Find the full token object from the token list
  const tokenFromList = useCofheToken({
    address: viewingToken?.address,
  });

  if (!viewingToken) {
    return (
      <div className="fnx-text-primary space-y-3">
        <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <span>Back</span>
        </button>
        <p className="text-xs opacity-70">Token information not available</p>
      </div>
    );
  }

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Header */}
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>

      {/* Token Icon and Name */}
      <div className="flex flex-col items-center gap-3">
        <TokenIcon logoURI={viewingToken.logoURI || tokenFromList?.logoURI} alt={viewingToken.name} size="xl" />
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-bold">{viewingToken.name}</h2>
          <p className="text-sm opacity-70">{viewingToken.symbol}</p>
        </div>
      </div>

      {/* Balance Section */}
      <div className="fnx-card-bg rounded-lg p-4 border fnx-card-border">
        <div className="flex flex-col gap-2">
          <p className="text-xs opacity-70">Balance</p>
          <TokenBalance token={tokenFromList} size="xl" decimalPrecision={5} className="font-bold" />
        </div>
      </div>

      {/* Token Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Token Details</h3>

        {/* Address */}
        <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
          <div className="flex flex-col gap-2">
            <p className="text-xxxs opacity-70">Contract Address</p>
            <AddressButton address={viewingToken.address} className="w-full justify-start" />
          </div>
        </div>

        {/* Decimals */}
        <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
          <div className="flex items-center justify-between">
            <p className="text-xxxs opacity-70">Decimals</p>
            <p className="text-sm font-medium">{viewingToken.decimals}</p>
          </div>
        </div>

        {/* Confidentiality Type */}
        {tokenFromList && (
          <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
            <div className="flex items-center justify-between">
              <p className="text-xxxs opacity-70">Confidentiality Type</p>
              <p className="text-sm font-medium capitalize">{tokenFromList.extensions.fhenix.confidentialityType}</p>
            </div>
          </div>
        )}

        {/* Confidential Value Type */}
        {tokenFromList && (
          <div className="fnx-card-bg rounded-lg p-3 border fnx-card-border">
            <div className="flex items-center justify-between">
              <p className="text-xxxs opacity-70">Value Type</p>
              <p className="text-sm font-medium">{tokenFromList.extensions.fhenix.confidentialValueType}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
