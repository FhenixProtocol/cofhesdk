import {
  encodeAbiParameters,
  keccak256,
  parseAbi,
  type AbiParameterToPrimitiveType,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { ACPUtils } from './acp.js';
import type { ACP } from './types.js';

/**
 * The on-chain sharing pieces: the share registry and revoker ABIs, the registry payload of a
 * sharing ACP and its share id, and the read of a share from its `Shared` event. Exported so an
 * app can send these writes through its own transaction path and still agree with the registry
 * on ids.
 *
 * The registry is pointer-based: storage keeps a share header (issuer, expiration, recipient,
 * revoker, and the block of its `Shared` event); the full payload and the metadata blob travel in
 * that event. A reader takes headers from `sharesFor` / `getShare` and fetches the events with one
 * single-block `getLogs` per block.
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
  'struct ShareHeader { address issuer; uint64 expiration; address recipient; uint64 blockNumber; address revokerContract; uint256 revokerData; }',
  'function share(ACP calldata acp, bytes calldata metadata) external returns (bytes32)',
  'function removeShare(bytes32 shareId) external',
  'function sharesFor(address recipient) external view returns (bytes32[] shareIds, ShareHeader[] headers)',
  'function getShare(bytes32 shareId) external view returns (ShareHeader memory)',
  'function isShareValid(bytes32 shareId) external view returns (bool)',
  'event Shared(address indexed recipient, address indexed issuer, bytes32 indexed shareId, ACP acp, bytes metadata)',
  'event ShareRemoved(address indexed recipient, address indexed issuer, bytes32 indexed shareId)',
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

/** The share id of a registry payload as read back from a `Shared` event. */
export const shareIdOfChainShare = (share: ChainShare): Hex =>
  keccak256(encodeAbiParameters(ACP_SHARE_TUPLE_ABI, [share]));

/** A registry payload, as decoded from a `Shared` event (or passed to `share`). */
export type ChainShare = AbiParameterToPrimitiveType<(typeof ACP_SHARE_TUPLE_ABI)[0]>;

/** What the registry stores of a share: the fields it checks, and the block of its `Shared` event. */
export type ShareHeader = {
  issuer: Address;
  expiration: bigint;
  recipient: Address;
  /** Block of the `Shared` event (the L2 block on Arbitrum). */
  blockNumber: bigint;
  revokerContract: Address;
  revokerData: bigint;
};

/** A share as posted: its payload and the metadata blob that came with it (`0x` when none). */
export type PostedShare = { shareId: Hex; header: ShareHeader; share: ChainShare; metadata: Hex };

/**
 * Fetches the `Shared` events of shares from the blocks their headers name: one single-block
 * `getLogs` per distinct block, filtered by registry and share ids, so any node answers it. Returns
 * the shares in the order given. Throws when a block holds no `Shared` event of a share it should,
 * or an event's payload does not hash to its share id.
 */
export const readPostedShares = async (
  publicClient: PublicClient,
  registry: Address,
  headers: readonly { shareId: Hex; header: ShareHeader }[]
): Promise<PostedShare[]> => {
  const idsByBlock = new Map<bigint, Hex[]>();
  for (const { shareId, header } of headers) {
    idsByBlock.set(header.blockNumber, [...(idsByBlock.get(header.blockNumber) ?? []), shareId]);
  }

  const found = new Map<string, { share: ChainShare; metadata: Hex }>();
  await Promise.all(
    [...idsByBlock].map(async ([block, shareIds]) => {
      const logs = await publicClient.getContractEvents({
        address: registry,
        abi: ACP_SHARE_REGISTRY_ABI,
        eventName: 'Shared',
        args: { shareId: shareIds },
        fromBlock: block,
        toBlock: block,
        strict: true,
      });
      for (const { args } of logs) {
        if (shareIdOfChainShare(args.acp).toLowerCase() !== args.shareId.toLowerCase()) {
          throw new Error(`Share ${args.shareId}: the payload in its Shared event does not hash to its id`);
        }
        found.set(args.shareId.toLowerCase(), { share: args.acp, metadata: args.metadata });
      }
    })
  );

  return headers.map(({ shareId, header }) => {
    const posted = found.get(shareId.toLowerCase());
    if (posted == null) {
      throw new Error(`Share ${shareId}: no Shared event in block ${header.blockNumber}, where the registry points`);
    }
    return { shareId, header, ...posted };
  });
};

/** The importable shares addressed to `recipient` (unexpired, not revoked), read from their events. */
export const readSharesFor = async (
  publicClient: PublicClient,
  registry: Address,
  recipient: Address
): Promise<PostedShare[]> => {
  const [shareIds, headers] = await publicClient.readContract({
    address: registry,
    abi: ACP_SHARE_REGISTRY_ABI,
    functionName: 'sharesFor',
    args: [recipient],
  });
  return readPostedShares(
    publicClient,
    registry,
    shareIds.map((shareId, i) => ({ shareId, header: headers[i] }))
  );
};

/** One share by id, read from its event; null when the registry has no such share (unknown or removed). */
export const readShare = async (
  publicClient: PublicClient,
  registry: Address,
  shareId: Hex
): Promise<PostedShare | null> => {
  const header = await publicClient.readContract({
    address: registry,
    abi: ACP_SHARE_REGISTRY_ABI,
    functionName: 'getShare',
    args: [shareId],
  });
  if (header.issuer === '0x0000000000000000000000000000000000000000') return null;
  const [posted] = await readPostedShares(publicClient, registry, [{ shareId, header }]);
  return posted;
};
