/**
 * Token types shared across hooks/components/utils.
 *
 * IMPORTANT: Keep this file dependency-free (no imports from hooks/providers/utils)
 * to avoid circular dependencies.
 */

/**
 * Special address representing native ETH (used in erc20Pair for ConfidentialETH tokens)
 */
export const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

/**
 * ERC20 pair information for wrapped confidential tokens
 */
export type Erc20Pair = {
  /** Address of the underlying ERC20 token (or ETH_ADDRESS for native ETH) */
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

export type Token = {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions: Record<string, unknown> & {
    fhenix: {
      confidentialityType: 'wrapped' | 'pure' | 'dual';
      confidentialValueType: 'uint64' | 'uint128';
      /** ERC20 pair for wrapped tokens - contains underlying token info */
      erc20Pair?: Erc20Pair;
    };
  };
};

// just a sample token for examples and quick tests
export const WETH_SEPOLIA_TOKEN: Token = {
  chainId: 11155111,
  address: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A',
  name: 'Redact eETH',
  symbol: 'eETH',
  decimals: 18,
  logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
  extensions: {
    fhenix: {
      confidentialityType: 'wrapped',
      confidentialValueType: 'uint128',
      erc20Pair: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
      },
    },
  },
};
