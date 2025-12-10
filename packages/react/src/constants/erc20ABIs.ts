import { parseAbi } from 'viem';

// ============================================================================
// Standard ERC20 ABIs
// ============================================================================

/**
 * Standard ERC20 balanceOf function ABI
 */
export const ERC20_BALANCE_OF_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

/**
 * Standard ERC20 decimals function ABI
 */
export const ERC20_DECIMALS_ABI = parseAbi(['function decimals() view returns (uint8)']);

/**
 * Standard ERC20 symbol function ABI
 */
export const ERC20_SYMBOL_ABI = parseAbi(['function symbol() view returns (string)']);

/**
 * Standard ERC20 name function ABI
 */
export const ERC20_NAME_ABI = parseAbi(['function name() view returns (string)']);
