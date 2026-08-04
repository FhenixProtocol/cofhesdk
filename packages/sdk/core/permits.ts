import {
  type ImportSharedPermitOptions,
  ACPUtils,
  type CreateSelfPermitOptions,
  type CreateSharingPermitOptions,
  type ACP,
  permitStore,
  type SerializedPermit,
  type SelfPermit,
  type RecipientPermit,
  type IncomingShare,
  type SharingPermit,
  type PermitHashFields,
} from '@/permits';

import {
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeAbiParameters,
  keccak256,
  parseAbi,
  zeroAddress,
} from 'viem';

import { TASK_MANAGER_ADDRESS } from './consts.js';

// ACP default revoker (timestamp-based revocation) — interface shared by all revokers
const ACP_VALIDATOR_ABI = parseAbi([
  'function revokeSingle(uint256 id)',
  'function revokeAllExisting()',
  'function disabled(address issuer, uint256 id) view returns (bool)',
]);

// HELPERS

// Store a permit without changing which permit is active.
const storePermit = async (acp: ACP, publicClient: any, walletClient: any) => {
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, acp);
};

// Store a permit AND select it as the active permit.
const storeActivePermit = async (acp: ACP, publicClient: any, walletClient: any) => {
  await storePermit(acp, publicClient, walletClient);
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;
  permitStore.setActivePermitHash(chainId, account, acp.hash);
};

// Generic function to handle permit creation with error handling.
// `activate` controls whether the new permit becomes the issuer's active permit — true for
// self/imported permits (the connected user decrypts with them), false for sharing permits (those
// are delegated to a recipient and are never the issuer's own active permit).
const createPermitWithSign = async <T, TPermit extends ACP>(
  options: T,
  publicClient: PublicClient,
  walletClient: WalletClient,
  permitMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<TPermit>,
  activate = true
): Promise<TPermit> => {
  const acp = await permitMethod(options, publicClient, walletClient);
  if (activate) {
    await storeActivePermit(acp, publicClient, walletClient);
  } else {
    await storePermit(acp, publicClient, walletClient);
  }
  return acp;
};

// CREATE

/**
 * Create a permit usable by the connected user
 * Stores the permit and selects it as the active permit
 * @param options - The options for creating a self permit
 * @returns The created permit or error
 */
const createSelf = async (
  options: CreateSelfPermitOptions,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<SelfPermit> => {
  return createPermitWithSign(options, publicClient, walletClient, ACPUtils.createSelfAndSign);
};

const createSharing = async (
  options: CreateSharingPermitOptions,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<SharingPermit> => {
  // A sharing permit is delegated to a recipient — it is never the issuer's own active permit, so
  // creating one only stores it (unlike self/imported permits, which activate).
  return createPermitWithSign(options, publicClient, walletClient, ACPUtils.createSharingAndSign, false);
};

const importShared = async (
  options: ImportSharedPermitOptions | string,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<RecipientPermit> => {
  return createPermitWithSign(options, publicClient, walletClient, ACPUtils.importSharedAndSign);
};

// PERMIT UTILS

const getHash = (permit: PermitHashFields) => {
  return ACPUtils.getHash(permit);
};

const exportShared = (permit: ACP) => {
  return ACPUtils.export(permit);
};

const serialize = (permit: ACP) => {
  return ACPUtils.serialize(permit);
};

const deserialize = (serialized: SerializedPermit) => {
  return ACPUtils.deserialize(serialized);
};

// GET

const getPermit = (chainId: number, account: string, hash: string): ACP | undefined => {
  return permitStore.getPermit(chainId, account, hash);
};

const getPermits = (chainId: number, account: string): Record<string, ACP> => {
  return permitStore.getPermits(chainId, account);
};

const getActivePermit = (chainId: number, account: string): ACP | undefined => {
  return permitStore.getActivePermit(chainId, account);
};

const getActivePermitHash = (chainId: number, account: string): string | undefined => {
  return permitStore.getActivePermitHash(chainId, account);
};

const selectActivePermit = (chainId: number, account: string, hash: string): void => {
  permitStore.setActivePermitHash(chainId, account, hash);
};

// GET OR CREATE

/**
 * Get the active self permit if a valid one exists, otherwise create a new one.
 *
 * An active permit is reused only when it is a self permit and is still valid
 * (signed and not expired). An expired or otherwise invalid active permit is
 * treated as missing and a fresh permit is created.
 *
 * @param publicClient - The public client
 * @param walletClient - The wallet client
 * @param chainId - Optional chain ID (will use publicClient if not provided)
 * @param account - Optional account (will use walletClient if not provided)
 * @param options - The options for creating a self permit
 * @returns The existing valid permit or a newly created one
 */
const getOrCreateSelfPermit = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
  chainId?: number,
  account?: string,
  options?: CreateSelfPermitOptions
): Promise<ACP> => {
  const _chainId = chainId ?? (await publicClient.getChainId());
  const _account = account ?? walletClient.account!.address;

  // Try to get active permit first
  const activePermit = await getActivePermit(_chainId, _account);

  if (activePermit && activePermit.type === 'self' && ACPUtils.isValid(activePermit).valid) {
    return activePermit;
  }

  // No active permit, wrong type, or expired/invalid - create new one
  return createSelf(options ?? { issuer: _account, name: 'Autogenerated Self ACP' }, publicClient, walletClient);
};

/**
 * Return the active permit if it is already a valid sharing permit, otherwise create and store a
 * new sharing permit.
 *
 * The newly created permit is NOT activated: a sharing permit is delegated to a recipient and is
 * never the issuer's own active permit. (The existing-active branch only matches if a sharing
 * permit was made active by other means, e.g. `selectActivePermit`.)
 *
 * @param publicClient - The public client
 * @param walletClient - The wallet client
 * @param options - The options for creating a sharing permit (required)
 * @param chainId - Optional chain ID (will use publicClient if not provided)
 * @param account - Optional account (will use walletClient if not provided)
 * @returns The existing valid active sharing permit, or a newly created (unactivated) one
 */
const getOrCreateSharingPermit = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
  options: CreateSharingPermitOptions,
  chainId?: number,
  account?: string
): Promise<ACP> => {
  const _chainId = chainId ?? (await publicClient.getChainId());
  const _account = account ?? walletClient.account!.address;

  // Try to get active permit first
  const activePermit = await getActivePermit(_chainId, _account);

  if (activePermit && activePermit.type === 'sharing' && ACPUtils.isValid(activePermit).valid) {
    return activePermit;
  }

  return createSharing(options, publicClient, walletClient);
};

// CONFIG DEFAULTS

/**
 * Applies the config's ACP permit defaults to creation options (pure).
 * Explicit user options always win:
 *  - revoker: injected only when the options carry NO revoker pair —
 *    revokerContract = config default, revokerData = creation timestamp
 *    ("every permit revocable by default")
 *  - contracts: injected only when the options carry NO scope fields at all —
 *    injecting scope makes the created permit non-global by default
 */
const applyPermitDefaults = <
  T extends {
    revokerData?: number;
    revokerContract?: string;
    scope?: number;
    contracts?: string[];
    handles?: (bigint | number | string)[];
  },
>(
  options: T,
  permitConfig: { defaultRevoker?: Record<number, Hex>; defaultContractScopes?: Record<number, Hex[]> } | undefined,
  chainId: number
): T => {
  const result = { ...options };

  const defaultRevoker = permitConfig?.defaultRevoker?.[chainId];
  const hasValidatorOptions = options.revokerData != null || options.revokerContract != null;
  if (defaultRevoker != null && !hasValidatorOptions) {
    result.revokerContract = defaultRevoker;
    // Creation timestamp minus a clock-skew allowance: the revoker rejects
    // future-dated ids (vs block.timestamp of the LAST block), so a local clock
    // ahead of the chain — or a chain with sparse blocks — would otherwise make
    // a fresh permit temporarily unusable. 60s of backdating costs nothing
    // (revokeAllExisting at time T still kills this permit for any T >= id).
    result.revokerData = Math.round(Date.now() / 1000) - 60;
  }

  const defaultContracts = permitConfig?.defaultContractScopes?.[chainId];
  const hasScopeOptions = options.scope != null || options.contracts != null || options.handles != null;
  if (defaultContracts != null && defaultContracts.length > 0 && !hasScopeOptions) {
    result.contracts = defaultContracts;
  }

  return result;
};

// ACL-SERVED ADDRESSES (defaultRevokerContract / shareRegistry)

const ACL_SERVED_ADDRESSES_ABI = parseAbi([
  'function acl() view returns (address)',
  'function defaultRevokerContract() view returns (address)',
  'function shareRegistry() view returns (address)',
]);

export interface AclServedAddresses {
  defaultRevoker?: Hex;
  shareRegistry?: Hex;
}

const aclServedAddressesCache = new Map<number, AclServedAddresses>();

/** Test hook: forget resolved addresses (e.g. between redeployments on one chainId). */
const clearAclServedAddresses = () => aclServedAddressesCache.clear();

/**
 * The ACP infrastructure addresses the chain's ACL serves (TaskManager -> acl()
 * -> getters). Zero addresses and pre-upgrade ACLs (getters absent -> revert)
 * resolve to `undefined` — callers fall back to `permit.*` config.
 *
 * Resolutions are cached per chainId. A failure to reach the TaskManager (network
 * error, no CoFHE deployment) is NOT cached, so a transient outage does not pin
 * an empty result for the whole session.
 */
const getAclServedAddresses = async (publicClient: PublicClient, chainId: number): Promise<AclServedAddresses> => {
  const cached = aclServedAddressesCache.get(chainId);
  if (cached != null) return cached;

  let aclAddress: Hex;
  try {
    aclAddress = await publicClient.readContract({
      address: TASK_MANAGER_ADDRESS,
      abi: ACL_SERVED_ADDRESSES_ABI,
      functionName: 'acl',
    });
  } catch {
    return {};
  }

  const [defaultRevoker, shareRegistry] = await Promise.all([
    publicClient
      .readContract({ address: aclAddress, abi: ACL_SERVED_ADDRESSES_ABI, functionName: 'defaultRevokerContract' })
      .catch(() => undefined),
    publicClient
      .readContract({ address: aclAddress, abi: ACL_SERVED_ADDRESSES_ABI, functionName: 'shareRegistry' })
      .catch(() => undefined),
  ]);

  const resolved: AclServedAddresses = {
    defaultRevoker: defaultRevoker != null && defaultRevoker !== zeroAddress ? defaultRevoker : undefined,
    shareRegistry: shareRegistry != null && shareRegistry !== zeroAddress ? shareRegistry : undefined,
  };
  aclServedAddressesCache.set(chainId, resolved);
  return resolved;
};

/**
 * `applyPermitDefaults` with the ACL consulted for the default revoker when
 * `permit.defaultRevoker` config does not name one for this chain — explicit
 * config wins over the ACL-served address.
 */
const applyPermitDefaultsFromChain = async <
  T extends {
    revokerData?: number;
    revokerContract?: string;
    scope?: number;
    contracts?: string[];
    handles?: (bigint | number | string)[];
  },
>(
  options: T,
  permitConfig: { defaultRevoker?: Record<number, Hex>; defaultContractScopes?: Record<number, Hex[]> } | undefined,
  publicClient: PublicClient,
  chainId: number
): Promise<T> => {
  const hasExplicitRevoker =
    permitConfig?.defaultRevoker?.[chainId] != null || options.revokerData != null || options.revokerContract != null;
  if (hasExplicitRevoker) return applyPermitDefaults(options, permitConfig, chainId);

  const served = await getAclServedAddresses(publicClient, chainId);
  const effectiveConfig =
    served.defaultRevoker != null
      ? { ...permitConfig, defaultRevoker: { ...permitConfig?.defaultRevoker, [chainId]: served.defaultRevoker } }
      : permitConfig;
  return applyPermitDefaults(options, effectiveConfig, chainId);
};

// REVOKE (on-chain, via the permit's revoker contract)

/**
 * Revoke a single permit on-chain via its revoker contract.
 * Only the permit's issuer can revoke it (enforced by the revoker: revocations
 * are keyed by msg.sender). The permit stays in local storage — on-chain
 * validation will reject it from the next block onwards.
 *
 * @returns the revocation transaction hash
 */
const revokePermit = async (permit: ACP, walletClient: WalletClient): Promise<Hex> => {
  if (permit.revokerContract === zeroAddress || permit.revokerData === 0) {
    throw new Error('ACP is not revocable: it has no revoker (revokerContract/revokerData unset)');
  }
  if (walletClient.account == null) throw new Error('Missing walletClient account');
  if (walletClient.account.address.toLowerCase() !== permit.issuer.toLowerCase()) {
    throw new Error('Only the permit issuer can revoke it');
  }

  return walletClient.writeContract({
    address: permit.revokerContract,
    abi: ACP_VALIDATOR_ABI,
    functionName: 'revokeSingle',
    args: [BigInt(permit.revokerData)],
    account: walletClient.account,
    chain: walletClient.chain,
  });
};

/**
 * Revoke ALL of the caller's permits created up to now (O(1) on-chain:
 * a single threshold write on the revoker). Permits created after this
 * transaction remain valid.
 *
 * @param revokerContract - the revoker to revoke against (defaults to the
 *   connected account's active permit's revoker when omitted)
 * @returns the revocation transaction hash
 */
const revokeAllPermits = async (
  walletClient: WalletClient,
  publicClient: PublicClient,
  revokerContract?: Hex
): Promise<Hex> => {
  if (walletClient.account == null) throw new Error('Missing walletClient account');

  let revoker = revokerContract;
  if (revoker == null) {
    const chainId = await publicClient.getChainId();
    const active = getActivePermit(chainId, walletClient.account.address);
    revoker = active?.revokerContract;
  }
  if (revoker == null || revoker === zeroAddress) {
    throw new Error('No revoker contract: pass `revokerContract` or activate a revocable permit first');
  }

  return walletClient.writeContract({
    address: revoker,
    abi: ACP_VALIDATOR_ABI,
    functionName: 'revokeAllExisting',
    args: [],
    account: walletClient.account,
    chain: walletClient.chain,
  });
};

/**
 * Check whether a permit has been revoked (or is otherwise disabled) by its
 * revoker. Returns false for permits without a revoker (not revocable).
 */
const isPermitRevoked = async (permit: ACP, publicClient: PublicClient): Promise<boolean> => {
  if (permit.revokerContract === zeroAddress || permit.revokerData === 0) return false;
  return publicClient.readContract({
    address: permit.revokerContract,
    abi: ACP_VALIDATOR_ABI,
    functionName: 'disabled',
    args: [permit.issuer, BigInt(permit.revokerData)],
  });
};

// SHARE (on-chain, via the ACPShareRegistry)

const ACP_SHARE_REGISTRY_ABI = parseAbi([
  'struct ACP { address issuer; uint64 expiration; address recipient; uint256 revokerData; address revokerContract; uint8 scope; address[] contracts; bytes32[] handles; bytes32 sealingKey; bytes issuerSignature; bytes recipientSignature; }',
  'function share(ACP calldata acp) external returns (bytes32)',
  'function removeShare(bytes32 shareId) external',
  'function sharesFor(address recipient) external view returns (ACP[] memory)',
  'function getShare(bytes32 shareId) external view returns (ACP memory)',
  'function isShareValid(bytes32 shareId) external view returns (bool)',
]);

const ACP_TUPLE = [
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
const toChainShare = (acp: ACP) => ({
  issuer: acp.issuer,
  expiration: BigInt(acp.expiration),
  recipient: acp.recipient,
  revokerData: BigInt(acp.revokerData),
  revokerContract: acp.revokerContract,
  scope: acp.scope,
  contracts: acp.contracts,
  handles: acp.handles,
  sealingKey: ZERO_BYTES32,
  issuerSignature: acp.issuerSignature,
  recipientSignature: '0x' as Hex,
});

/** Mirrors the registry's `keccak256(abi.encode(acp))` share id. */
const computeShareId = (acp: ACP): Hex => {
  const p = toChainShare(acp);
  return keccak256(encodeAbiParameters(ACP_TUPLE, [p]));
};

/**
 * Post a signed sharing ACP to the on-chain share registry for its recipient
 * to discover and import — the on-chain alternative to `export()`.
 */
const shareOnChain = async (
  acp: ACP,
  walletClient: WalletClient,
  registry: Hex
): Promise<{ txHash: Hex; shareId: Hex }> => {
  if (acp.type !== 'sharing') {
    throw new Error(`Cannot share a '${acp.type}' ACP on-chain — only 'sharing' ACPs are shareable.`);
  }
  if (acp.issuerSignature === '0x') {
    throw new Error('Cannot share an unsigned sharing ACP — sign it first.');
  }
  if (walletClient.account == null) throw new Error('Missing walletClient account');
  if (walletClient.account.address.toLowerCase() !== acp.issuer.toLowerCase()) {
    throw new Error('Only the ACP issuer can share it on-chain');
  }

  const txHash = await walletClient.writeContract({
    address: registry,
    abi: ACP_SHARE_REGISTRY_ABI,
    functionName: 'share',
    args: [toChainShare(acp)],
    account: walletClient.account,
    chain: walletClient.chain ?? null,
  });

  return { txHash, shareId: computeShareId(acp) };
};

/** All importable shares addressed to `recipient` (unexpired, not revoked). */
const getIncomingShares = async (
  publicClient: PublicClient,
  registry: Hex,
  recipient: Hex
): Promise<IncomingShare[]> => {
  const raw = await publicClient.readContract({
    address: registry,
    abi: ACP_SHARE_REGISTRY_ABI,
    functionName: 'sharesFor',
    args: [recipient],
  });

  return raw.map((s) => ({
    shareId: keccak256(encodeAbiParameters(ACP_TUPLE, [s])),
    issuer: s.issuer,
    expiration: Number(s.expiration),
    recipient: s.recipient,
    revokerData: Number(s.revokerData),
    revokerContract: s.revokerContract,
    scope: Number(s.scope),
    contracts: [...s.contracts],
    handles: [...s.handles],
    issuerSignature: s.issuerSignature,
  }));
};

/**
 * Import a share read from the registry: fills the recipient's sealing key,
 * signs, stores and activates — the on-chain counterpart of importing an
 * exported JSON blob. The share stays on-chain until dismissed.
 */
const importFromChain = async (
  share: IncomingShare,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<RecipientPermit> => {
  const { shareId: _shareId, ...options } = share;
  return importShared({ ...options, type: 'sharing' }, publicClient, walletClient);
};

/** Remove a share from the registry (issuer retracts / recipient dismisses). */
const removeShareOnChain = async (shareId: Hex, walletClient: WalletClient, registry: Hex): Promise<Hex> => {
  if (walletClient.account == null) throw new Error('Missing walletClient account');
  return walletClient.writeContract({
    address: registry,
    abi: ACP_SHARE_REGISTRY_ABI,
    functionName: 'removeShare',
    args: [shareId],
    account: walletClient.account,
    chain: walletClient.chain ?? null,
  });
};

// REMOVE

const removePermit = async (chainId: number, account: string, hash: string): Promise<void> =>
  permitStore.removePermit(chainId, account, hash);

const removeActivePermit = async (chainId: number, account: string): Promise<void> =>
  permitStore.removeActivePermitHash(chainId, account);

// EXPORT

export const permits = {
  getSnapshot: permitStore.store.getState,
  subscribe: permitStore.store.subscribe,

  createSelf,
  createSharing,
  importShared,

  getOrCreateSelfPermit,
  getOrCreateSharingPermit,

  getHash,
  export: exportShared,
  serialize,
  deserialize,

  getPermit,
  getPermits,
  getActivePermit,
  getActivePermitHash,
  removePermit,
  selectActivePermit,
  removeActivePermit,

  revokePermit,
  revokeAllPermits,
  isPermitRevoked,

  shareOnChain,
  getIncomingShares,
  importFromChain,
  removeShareOnChain,
  computeShareId,

  applyPermitDefaults,
  applyPermitDefaultsFromChain,
  getAclServedAddresses,
  clearAclServedAddresses,
};

/** @deprecated renamed — use `acp` (public terminology: permit -> ACP) */
export const acp = permits;
