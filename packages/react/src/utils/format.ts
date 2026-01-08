import BigNumber from 'bignumber.js';

export type TokenFormatOutput = {
  /** Raw balance in smallest unit (bigint) */
  wei: bigint;
  /** Numeric balance value */
  unit: BigNumber;
  /** Formatted balance string */
  formatted: string;
};

export function formatTokenAmount(amount: bigint, decimals: number, displayDecimals?: number): TokenFormatOutput {
  const amountBN = new BigNumber(amount).dividedBy(10 ** decimals);
  return {
    wei: amount,
    unit: amountBN,
    formatted: displayDecimals ? amountBN.toFixed(displayDecimals) : amountBN.toFixed(), // the only precise way, without parseFloat
  };
}

export function unitToWei(amount: string, decimals: number): bigint {
  return BigInt(new BigNumber(amount).multipliedBy(10 ** decimals).toFixed(0));
}
