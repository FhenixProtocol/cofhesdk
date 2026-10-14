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
    formatted: displayDecimals
      ? amountBN
          .toFixed(displayDecimals)
          // remove trailing zeros
          .replace(/\.?0+$/, '')
      : amountBN.toFixed(), // the only precise way, without parseFloat
  };
}

export function unitToWei(amount: string, decimals: number): bigint {
  return BigInt(new BigNumber(amount).multipliedBy(10 ** decimals).toFixed(0));
}

/**
 * Convert a raw amount between denominations with different decimals (e.g. public ERC20 wei
 * to confidential base units). Rounds down when precision is lost, mirroring on-chain truncation.
 */
export function scaleAmount(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return amount;
  if (fromDecimals > toDecimals) return amount / 10n ** BigInt(fromDecimals - toDecimals);
  return amount * 10n ** BigInt(toDecimals - fromDecimals);
}

/**
 * Round a human-entered amount string down to at most `decimals` fractional digits.
 * Non-numeric input is returned unchanged.
 */
export function quantizeAmount(amount: string, decimals: number): string {
  const amountBN = new BigNumber(amount);
  if (!amountBN.isFinite()) return amount;
  return amountBN.decimalPlaces(decimals, BigNumber.ROUND_FLOOR).toFixed();
}

export function formatUsdAmount(amount: number | BigNumber, displayDecimals: number = 2): string {
  const amountBN = BigNumber.isBigNumber(amount) ? amount : new BigNumber(amount);
  return `$${amountBN.toFormat(displayDecimals)}`;
}
