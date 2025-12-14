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
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions: {
    fhenix: {
      confidentialityType: 'wrapped' | 'pure' | 'dual';
      confidentialValueType: 'uint64' | 'uint128';
      /** ERC20 pair for wrapped tokens - contains underlying token info */
      erc20Pair?: Erc20Pair;
    };
  };
};
