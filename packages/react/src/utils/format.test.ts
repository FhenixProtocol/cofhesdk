import { describe, expect, it } from 'vitest';
import { quantizeAmount, scaleAmount } from './format';
import { getConfidentialDecimals, getPublicDecimals, getPublicSymbol, normalizeToken } from '../types/token';

const token = normalizeToken({
  chainId: 84532,
  address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
  name: 'Sample FHE ETH',
  symbol: 'fhETH',
  decimals: 6,
  extensions: {
    fhenix: {
      confidentialityType: 'wrappedNative',
      confidentialValueType: 'uint64',
      erc20Pair: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        decimals: 18,
      },
    },
  },
})!;

describe('decimals accessors', () => {
  it('reads the public side from the erc20 pair', () => {
    expect(getPublicDecimals(token)).toBe(18);
    expect(getConfidentialDecimals(token)).toBe(6);
    expect(getPublicSymbol(token)).toBe('ETH');
  });

  it('falls back to the token itself without a pair', () => {
    const dual = { ...token, extensions: { fhenix: { ...token.extensions.fhenix, erc20Pair: undefined } } };
    expect(getPublicDecimals(dual)).toBe(6);
    expect(getPublicSymbol(dual)).toBe('fhETH');
  });
});

describe('scaleAmount', () => {
  it('is identity for equal decimals', () => {
    expect(scaleAmount(123n, 6, 6)).toBe(123n);
  });

  it('scales down with truncation', () => {
    expect(scaleAmount(1_000_000_000_000_999_999n, 18, 6)).toBe(1_000_000n);
  });

  it('scales up exactly', () => {
    expect(scaleAmount(1_500_000n, 6, 18)).toBe(1_500_000_000_000_000_000n);
  });
});

describe('quantizeAmount', () => {
  it('floors extra fractional digits', () => {
    expect(quantizeAmount('1.0000019', 6)).toBe('1.000001');
  });

  it('keeps amounts already within precision', () => {
    expect(quantizeAmount('1.25', 6)).toBe('1.25');
  });

  it('returns non-numeric input unchanged', () => {
    expect(quantizeAmount('', 6)).toBe('');
    expect(quantizeAmount('abc', 6)).toBe('abc');
  });
});
