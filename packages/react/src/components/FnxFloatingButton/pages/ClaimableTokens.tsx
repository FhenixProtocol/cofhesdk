import { useCofheClaimableTokens } from '@/hooks/useCofheClaimableTokens';

export function ClaimableTokens() {
  // TODO: or show multichain, with switching?
  const chainsClaimableTokens = useCofheClaimableTokens();
  const claimableByTokenAddress = chainsClaimableTokens.claimableByTokenAddress;
  return (
    <div>
      {Object.entries(claimableByTokenAddress)
        .filter(([_t, amount]) => amount > 0)
        .map(([tokenAddress, claimableAmount]) => (
          <div key={tokenAddress}>
            <h3>Token: {tokenAddress}</h3>
            <p>Claimable Amount: {claimableAmount.toString()}</p>
          </div>
        ))}
    </div>
  );
}
