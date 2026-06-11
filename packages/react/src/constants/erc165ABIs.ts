import { parseAbi } from 'viem';

// ============================================================================
// Standard ERC165 ABIs
// ============================================================================

/**
 * Standard ERC165 supportsInterface function ABI
 */
export const ERC165_SUPPORTS_INTERFACE_ABI = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
]);
