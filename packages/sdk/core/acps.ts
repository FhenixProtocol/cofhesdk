import {
  type ImportSharedACPOptions,
  ACPUtils,
  type CreateSelfACPOptions,
  type CreateSharingACPOptions,
  type ACP,
  acpStore,
  type SerializedACP,
  type SelfACP,
  type RecipientACP,
  type IncomingShare,
  type SharingACP,
  type ACPHashFields,
  type ACPAccessStatus,
  ACP_REVOKER_ABI,
  ACP_SHARE_REGISTRY_ABI,
  toChainShare,
  computeShareId,
  shareIdOfChainShare,
  getAclServedAddresses,
  clearAclServedAddresses,
} from '@/acps';

import { type Hex, type PublicClient, type WalletClient, zeroAddress } from 'viem';

// HELPERS

// Store an ACP without changing which acp is active.
const storeACP = async (acp: ACP, publicClient: any, walletClient: any) => {
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  acpStore.setACP(chainId, account, acp);
};

// Store an ACP AND select it as the active acp.
const storeActiveACP = async (acp: ACP, publicClient: any, walletClient: any) => {
  await storeACP(acp, publicClient, walletClient);
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;
  acpStore.setActiveACPHash(chainId, account, acp.hash);
};

// Generic function to handle acp creation with error handling.
// `activate` controls whether the new acp becomes the connected account's active acp — true for
// self acps and, by default, imported acps (the connected user decrypts with them); false for
// sharing acps (delegated to a recipient, never the issuer's own active acp) and for imports
// made with `activate: false`.
const createACPWithSign = async <T, TACP extends ACP>(
  options: T,
  publicClient: PublicClient,
  walletClient: WalletClient,
  acpMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<TACP>,
  activate = true
): Promise<TACP> => {
  const acp = await acpMethod(options, publicClient, walletClient);
  if (activate) {
    await storeActiveACP(acp, publicClient, walletClient);
  } else {
    await storeACP(acp, publicClient, walletClient);
  }
  return acp;
};

// CREATE

/**
 * Create an ACP usable by the connected user
 * Stores the acp and selects it as the active acp
 * @param options - The options for creating a self acp
 * @returns The created acp or error
 */
const createSelf = async (
  options: CreateSelfACPOptions,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<SelfACP> => {
  return createACPWithSign(options, publicClient, walletClient, ACPUtils.createSelfAndSign);
};

const createSharing = async (
  options: CreateSharingACPOptions,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<SharingACP> => {
  // A sharing acp is delegated to a recipient — it is never the issuer's own active acp, so
  // creating one only stores it (unlike self/imported acps, which activate).
  return createACPWithSign(options, publicClient, walletClient, ACPUtils.createSharingAndSign, false);
};

/** Options for importing a shared acp. */
export type ImportActivationOptions = {
  /**
   * Make the imported acp the active one. Defaults to `true`.
   * With `false` the acp is only stored: decrypts that use the active acp keep using the current one,
   * and the imported acp is used only where it is passed explicitly (e.g. `.withACP(acp)`).
   */
  activate?: boolean;
};

const importShared = async (
  options: ImportSharedACPOptions | string,
  publicClient: PublicClient,
  walletClient: WalletClient,
  { activate = true }: ImportActivationOptions = {}
): Promise<RecipientACP> => {
  return createACPWithSign(options, publicClient, walletClient, ACPUtils.importSharedAndSign, activate);
};

// ACP UTILS

const getHash = (acp: ACPHashFields) => {
  return ACPUtils.getHash(acp);
};

const exportShared = (acp: ACP) => {
  return ACPUtils.export(acp);
};

const serialize = (acp: ACP) => {
  return ACPUtils.serialize(acp);
};

const deserialize = (serialized: SerializedACP) => {
  return ACPUtils.deserialize(serialized);
};

// GET

const getACP = (chainId: number, account: string, hash: string): ACP | undefined => {
  return acpStore.getACP(chainId, account, hash);
};

const getACPs = (chainId: number, account: string): Record<string, ACP> => {
  return acpStore.getACPs(chainId, account);
};

const getActiveACP = (chainId: number, account: string): ACP | undefined => {
  return acpStore.getActiveACP(chainId, account);
};

const getActiveACPHash = (chainId: number, account: string): string | undefined => {
  return acpStore.getActiveACPHash(chainId, account);
};

const selectActiveACP = (chainId: number, account: string, hash: string): void => {
  acpStore.setActiveACPHash(chainId, account, hash);
};

// GET OR CREATE

/**
 * Get the active self acp if a valid one exists, otherwise create a new one.
 *
 * An active acp is reused only when it is a self acp and is still valid
 * (signed and not expired). An expired or otherwise invalid active acp is
 * treated as missing and a fresh acp is created.
 *
 * @param publicClient - The public client
 * @param walletClient - The wallet client
 * @param chainId - Optional chain ID (will use publicClient if not provided)
 * @param account - Optional account (will use walletClient if not provided)
 * @param options - The options for creating a self acp
 * @returns The existing valid acp or a newly created one
 */
const getOrCreateSelfACP = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
  chainId?: number,
  account?: string,
  options?: CreateSelfACPOptions
): Promise<ACP> => {
  const _chainId = chainId ?? (await publicClient.getChainId());
  const _account = account ?? walletClient.account!.address;

  // Try to get active acp first
  const activeACP = await getActiveACP(_chainId, _account);

  if (activeACP && activeACP.type === 'self' && ACPUtils.isValid(activeACP).valid) {
    return activeACP;
  }

  // No active acp, wrong type, or expired/invalid - create new one
  return createSelf(options ?? { issuer: _account, name: 'Autogenerated Self ACP' }, publicClient, walletClient);
};

/**
 * Return the active acp if it is already a valid sharing acp, otherwise create and store a
 * new sharing acp.
 *
 * The newly created acp is NOT activated: a sharing acp is delegated to a recipient and is
 * never the issuer's own active acp. (The existing-active branch only matches if a sharing
 * acp was made active by other means, e.g. `selectActiveACP`.)
 *
 * @param publicClient - The public client
 * @param walletClient - The wallet client
 * @param options - The options for creating a sharing acp (required)
 * @param chainId - Optional chain ID (will use publicClient if not provided)
 * @param account - Optional account (will use walletClient if not provided)
 * @returns The existing valid active sharing acp, or a newly created (unactivated) one
 */
const getOrCreateSharingACP = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
  options: CreateSharingACPOptions,
  chainId?: number,
  account?: string
): Promise<ACP> => {
  const _chainId = chainId ?? (await publicClient.getChainId());
  const _account = account ?? walletClient.account!.address;

  // Try to get active acp first
  const activeACP = await getActiveACP(_chainId, _account);

  if (activeACP && activeACP.type === 'sharing' && ACPUtils.isValid(activeACP).valid) {
    return activeACP;
  }

  return createSharing(options, publicClient, walletClient);
};

// CONFIG DEFAULTS

/**
 * Applies the config's ACP acp defaults to creation options (pure).
 * Explicit user options always win:
 *  - revoker: injected only when the options carry NO revoker pair —
 *    revokerContract = config default, revokerData = creation timestamp
 *    ("every acp revocable by default")
 *  - contracts: injected only when the options carry NO scope fields at all —
 *    injecting scope makes the created acp non-global by default
 */
const applyACPDefaults = <
  T extends {
    revokerData?: number;
    revokerContract?: string;
    scope?: number;
    contracts?: string[];
    handles?: (bigint | number | string)[];
  },
>(
  options: T,
  acpConfig: { defaultRevoker?: Record<number, Hex>; defaultContractScopes?: Record<number, Hex[]> } | undefined,
  chainId: number
): T => {
  const result = { ...options };

  const defaultRevoker = acpConfig?.defaultRevoker?.[chainId];
  const hasValidatorOptions = options.revokerData != null || options.revokerContract != null;
  if (defaultRevoker != null && !hasValidatorOptions) {
    result.revokerContract = defaultRevoker;
    // Creation timestamp minus a clock-skew allowance: the revoker rejects
    // future-dated ids (vs block.timestamp of the LAST block), so a local clock
    // ahead of the chain — or a chain with sparse blocks — would otherwise make
    // a fresh acp temporarily unusable. 60s of backdating costs nothing
    // (revokeAllExisting at time T still kills this acp for any T >= id).
    result.revokerData = Math.round(Date.now() / 1000) - 60;
  }

  const defaultContracts = acpConfig?.defaultContractScopes?.[chainId];
  const hasScopeOptions = options.scope != null || options.contracts != null || options.handles != null;
  if (defaultContracts != null && defaultContracts.length > 0 && !hasScopeOptions) {
    result.contracts = defaultContracts;
  }

  return result;
};

/**
 * `applyACPDefaults` with the ACL consulted for the default revoker when
 * `acp.defaultRevoker` config does not name one for this chain — explicit
 * config wins over the ACL-served address.
 */
const applyACPDefaultsFromChain = async <
  T extends {
    revokerData?: number;
    revokerContract?: string;
    scope?: number;
    contracts?: string[];
    handles?: (bigint | number | string)[];
  },
>(
  options: T,
  acpConfig: { defaultRevoker?: Record<number, Hex>; defaultContractScopes?: Record<number, Hex[]> } | undefined,
  publicClient: PublicClient,
  chainId: number
): Promise<T> => {
  const hasExplicitRevoker =
    acpConfig?.defaultRevoker?.[chainId] != null || options.revokerData != null || options.revokerContract != null;
  if (hasExplicitRevoker) return applyACPDefaults(options, acpConfig, chainId);

  const served = await getAclServedAddresses(publicClient, chainId);
  const effectiveConfig =
    served.defaultRevoker != null
      ? { ...acpConfig, defaultRevoker: { ...acpConfig?.defaultRevoker, [chainId]: served.defaultRevoker } }
      : acpConfig;
  return applyACPDefaults(options, effectiveConfig, chainId);
};

// REVOKE (on-chain, via the acp's revoker contract)

/**
 * Revoke a single acp on-chain via its revoker contract.
 * Only the acp's issuer can revoke it (enforced by the revoker: revocations
 * are keyed by msg.sender). The acp stays in local storage — on-chain
 * validation will reject it from the next block onwards.
 *
 * @returns the revocation transaction hash
 */
const revokeACP = async (acp: ACP, walletClient: WalletClient): Promise<Hex> => {
  if (acp.revokerContract === zeroAddress || acp.revokerData === 0) {
    throw new Error('ACP is not revocable: it has no revoker (revokerContract/revokerData unset)');
  }
  if (walletClient.account == null) throw new Error('Missing walletClient account');
  if (walletClient.account.address.toLowerCase() !== acp.issuer.toLowerCase()) {
    throw new Error('Only the acp issuer can revoke it');
  }

  return walletClient.writeContract({
    address: acp.revokerContract,
    abi: ACP_REVOKER_ABI,
    functionName: 'revokeSingle',
    args: [BigInt(acp.revokerData)],
    account: walletClient.account,
    chain: walletClient.chain,
  });
};

/**
 * Revoke ALL of the caller's acps created up to now (O(1) on-chain:
 * a single threshold write on the revoker). ACPs created after this
 * transaction remain valid.
 *
 * @param revokerContract - the revoker to revoke against (defaults to the
 *   connected account's active acp's revoker when omitted)
 * @returns the revocation transaction hash
 */
const revokeAllACPs = async (
  walletClient: WalletClient,
  publicClient: PublicClient,
  revokerContract?: Hex
): Promise<Hex> => {
  if (walletClient.account == null) throw new Error('Missing walletClient account');

  let revoker = revokerContract;
  if (revoker == null) {
    const chainId = await publicClient.getChainId();
    const active = getActiveACP(chainId, walletClient.account.address);
    revoker = active?.revokerContract;
  }
  if (revoker == null || revoker === zeroAddress) {
    throw new Error('No revoker contract: pass `revokerContract` or activate a revocable acp first');
  }

  return walletClient.writeContract({
    address: revoker,
    abi: ACP_REVOKER_ABI,
    functionName: 'revokeAllExisting',
    args: [],
    account: walletClient.account,
    chain: walletClient.chain,
  });
};

/**
 * The ACP on-chain status as a value instead of a revert (see `ACPAccessStatus`): validity
 * without a handle, and whether the ACP may read `handle` with one.
 */
const checkAccess = async (acp: ACP, publicClient: PublicClient, handle?: bigint | Hex): Promise<ACPAccessStatus> => {
  // The issuer half of a share carries no recipient signature (the recipient adds it on import), so
  // the ACL check would always fail it. What can change for the issuer is expiry and revocation.
  if (acp.type === 'sharing' && handle === undefined) {
    if (ACPUtils.isExpired(acp)) return 'expired';
    return (await isACPRevoked(acp, publicClient)) ? 'revoked' : 'valid';
  }
  return ACPUtils.checkAccessOnChain(acp, publicClient, handle);
};

/**
 * Check whether an ACP has been revoked (or is otherwise disabled) by its
 * revoker. Returns false for acps without a revoker (not revocable).
 */
const isACPRevoked = async (acp: ACP, publicClient: PublicClient): Promise<boolean> => {
  if (acp.revokerContract === zeroAddress || acp.revokerData === 0) return false;
  return publicClient.readContract({
    address: acp.revokerContract,
    abi: ACP_REVOKER_ABI,
    functionName: 'disabled',
    args: [acp.issuer, BigInt(acp.revokerData)],
  });
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
    shareId: shareIdOfChainShare(s),
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
 * signs, stores and (unless `activate: false`) activates — the on-chain
 * counterpart of importing an exported JSON blob. The share stays on-chain
 * until dismissed.
 */
const importFromChain = async (
  share: IncomingShare,
  publicClient: PublicClient,
  walletClient: WalletClient,
  importOptions: ImportActivationOptions = {}
): Promise<RecipientACP> => {
  const { shareId: _shareId, ...options } = share;
  return importShared({ ...options, type: 'sharing' }, publicClient, walletClient, importOptions);
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

const removeACP = async (chainId: number, account: string, hash: string): Promise<void> =>
  acpStore.removeACP(chainId, account, hash);

const removeActiveACP = async (chainId: number, account: string): Promise<void> =>
  acpStore.removeActiveACPHash(chainId, account);

// EXPORT

export const acps = {
  getSnapshot: acpStore.store.getState,
  subscribe: acpStore.store.subscribe,

  createSelf,
  createSharing,
  importShared,

  getOrCreateSelfACP,
  getOrCreateSharingACP,

  getHash,
  export: exportShared,
  serialize,
  deserialize,

  getACP,
  getACPs,
  getActiveACP,
  getActiveACPHash,
  removeACP,
  selectActiveACP,
  removeActiveACP,

  revokeACP,
  revokeAllACPs,
  isACPRevoked,
  checkAccess,

  shareOnChain,
  getIncomingShares,
  importFromChain,
  removeShareOnChain,
  computeShareId,

  applyACPDefaults,
  applyACPDefaultsFromChain,
  getAclServedAddresses,
  clearAclServedAddresses,
};

/** @deprecated renamed — use `acp` (public terminology: acp -> ACP) */
export const acp = acps;
