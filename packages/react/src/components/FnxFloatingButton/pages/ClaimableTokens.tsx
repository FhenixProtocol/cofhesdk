import { useCofheClaimableTokens } from '@/hooks/useCofheClaimableTokens';
import { PageContainer } from '../components/PageContainer';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePortalNavigation } from '@/stores';
export function ClaimableTokens() {
  // TODO: or show multichain, with switching?
  const chainsClaimableTokens = useCofheClaimableTokens();
  const claimableByTokenAddress = chainsClaimableTokens.claimableByTokenAddress;
  const { navigateBack } = usePortalNavigation();
  return (
    <PageContainer
      header={
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={navigateBack}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Claimable Tokens List</span>
        </button>
      }
      content={Object.entries(claimableByTokenAddress)
        .filter(([_t, amount]) => amount > 0)
        .map(([tokenAddress, claimableAmount]) => (
          <div key={tokenAddress}>
            <h3>Token: {tokenAddress}</h3>
            <p>Claimable Amount: {claimableAmount.toString()}</p>
          </div>
        ))}
    />
  );
}
