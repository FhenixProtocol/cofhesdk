import { encodeAbiParameters, keccak256, parseAbi, type AbiParameterToPrimitiveType, type Hex } from 'viem';
import { ACPUtils } from './acp.js';
import type { ACP } from './types.js';

/**
 * The on-chain sharing pieces: the share registry and revoker ABIs, the registry payload of a
 * sharing ACP and its share id. Exported so an app can send these writes through its own
 * transaction path and still agree with the registry on ids.
 */

// ACP default revoker (timestamp-based revocation) — interface shared by all revokers
export const ACP_REVOKER_ABI = parseAbi([
  'function revokeSingle(uint256 id)',
  'function revokeAllExisting()',
  'function disabled(address issuer, uint256 id) view returns (bool)',
]);

// SHARE (on-chain, via the ACPShareRegistry)

export const ACP_SHARE_REGISTRY_ABI = parseAbi([
  'struct ACP { address issuer; uint64 expiration; address recipient; uint256 revokerData; address revokerContract; uint8 scope; address[] contracts; bytes32[] handles; bytes32 sealingKey; bytes issuerSignature; bytes recipientSignature; }',
  'function share(ACP calldata acp) external returns (bytes32)',
  'function removeShare(bytes32 shareId) external',
  'function sharesFor(address recipient) external view returns (ACP[] memory)',
  'function getShare(bytes32 shareId) external view returns (ACP memory)',
  'function isShareValid(bytes32 shareId) external view returns (bool)',
]);

export const ACP_SHARE_TUPLE_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'issuer', type: 'address' },
      { name: 'expiration', type: 'uint64' },
      { name: 'recipient', type: 'address' },
      { name: 'revokerData', type: 'uint256' },
      { name: 'revokerContract', type: 'address' },
      { name: 'scope', type: 'uint8' },
      { name: 'contracts', type: 'address[]' },
      { name: 'handles', type: 'bytes32[]' },
      { name: 'sealingKey', type: 'bytes32' },
      { name: 'issuerSignature', type: 'bytes' },
      { name: 'recipientSignature', type: 'bytes' },
    ],
  },
] as const;

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as Hex;

/** The on-chain payload for a sharing ACP: recipient-side fields empty. */
export const toChainShare = (acp: ACP) => {
  // Same public struct as the off-chain export flow (ACPUtils.getPublic), with
  // the recipient-side fields blanked — the recipient supplies them at import —
  // and uint fields widened for the ABI encoder.
  const pub = ACPUtils.getPublic(acp, true);
  return {
    ...pub,
    expiration: BigInt(pub.expiration),
    revokerData: BigInt(pub.revokerData),
    sealingKey: ZERO_BYTES32,
    recipientSignature: '0x' as Hex,
  };
};

/** Mirrors the registry's `keccak256(abi.encode(acp))` share id. */
export const computeShareId = (acp: ACP): Hex => {
  const p = toChainShare(acp);
  return keccak256(encodeAbiParameters(ACP_SHARE_TUPLE_ABI, [p]));
};

/** The share id of a registry payload as read back from `sharesFor` / `getShare`. */
export const shareIdOfChainShare = (share: AbiParameterToPrimitiveType<(typeof ACP_SHARE_TUPLE_ABI)[0]>): Hex =>
  keccak256(encodeAbiParameters(ACP_SHARE_TUPLE_ABI, [share]));
