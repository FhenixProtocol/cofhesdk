import {
  type ImportSharedPermitOptions,
  PermitUtils,
  type CreateSelfPermitOptions,
  type CreateSharingPermitOptions,
  type Permit,
  permitStore,
  type SerializedPermit,
  type SelfPermit,
  type RecipientPermit,
  type SharingPermit,
  type PermitHashFields,
} from '@/permits';

import { type Hex, type PublicClient, type WalletClient, parseAbi, zeroAddress } from 'viem';

// ACP default validator (timestamp-based revocation) — interface shared by all validators
const ACP_VALIDATOR_ABI = parseAbi([
  'function revokeSingle(uint256 id)',
  'function revokeAllExisting()',
  'function disabled(address issuer, uint256 id) view returns (bool)',
]);

// HELPERS

// Helper function to store permit as active permit
const storeActivePermit = async (permit: Permit, publicClient: any, walletClient: any) => {
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
  permitStore.setActivePermitHash(chainId, account, permit.hash);
};

// Generic function to handle permit creation with error handling
const createPermitWithSign = async <T, TPermit extends Permit>(
  options: T,
  publicClient: PublicClient,
  walletClient: WalletClient,
  permitMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<TPermit>
): Promise<TPermit> => {
  const permit = await permitMethod(options, publicClient, walletClient);
  await storeActivePermit(permit, publicClient, walletClient);
  return permit;
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
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.createSelfAndSign);
};

const createSharing = async (
  options: CreateSharingPermitOptions,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<SharingPermit> => {
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.createSharingAndSign);
};

const importShared = async (
  options: ImportSharedPermitOptions | string,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<RecipientPermit> => {
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.importSharedAndSign);
};

// PERMIT UTILS

const getHash = (permit: PermitHashFields) => {
  return PermitUtils.getHash(permit);
};

const exportShared = (permit: Permit) => {
  return PermitUtils.export(permit);
};

const serialize = (permit: Permit) => {
  return PermitUtils.serialize(permit);
};

const deserialize = (serialized: SerializedPermit) => {
  return PermitUtils.deserialize(serialized);
};

// GET

const getPermit = (chainId: number, account: string, hash: string): Permit | undefined => {
  return permitStore.getPermit(chainId, account, hash);
};

const getPermits = (chainId: number, account: string): Record<string, Permit> => {
  return permitStore.getPermits(chainId, account);
};

const getActivePermit = (chainId: number, account: string): Permit | undefined => {
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
): Promise<Permit> => {
  const _chainId = chainId ?? (await publicClient.getChainId());
  const _account = account ?? walletClient.account!.address;

  // Try to get active permit first
  const activePermit = await getActivePermit(_chainId, _account);

  if (activePermit && activePermit.type === 'self' && PermitUtils.isValid(activePermit).valid) {
    return activePermit;
  }

  // No active permit, wrong type, or expired/invalid - create new one
  return createSelf(options ?? { issuer: _account, name: 'Autogenerated Self Permit' }, publicClient, walletClient);
};

/**
 * Get the active sharing permit if a valid one exists, otherwise create a new one.
 *
 * An active permit is reused only when it is a sharing permit and is still valid
 * (signed and not expired). An expired or otherwise invalid active permit is
 * treated as missing and a fresh permit is created.
 *
 * @param publicClient - The public client
 * @param walletClient - The wallet client
 * @param options - The options for creating a sharing permit (required)
 * @param chainId - Optional chain ID (will use publicClient if not provided)
 * @param account - Optional account (will use walletClient if not provided)
 * @returns The existing valid permit or a newly created one
 */
const getOrCreateSharingPermit = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
  options: CreateSharingPermitOptions,
  chainId?: number,
  account?: string
): Promise<Permit> => {
  const _chainId = chainId ?? (await publicClient.getChainId());
  const _account = account ?? walletClient.account!.address;

  // Try to get active permit first
  const activePermit = await getActivePermit(_chainId, _account);

  if (activePermit && activePermit.type === 'sharing' && PermitUtils.isValid(activePermit).valid) {
    return activePermit;
  }

  return createSharing(options, publicClient, walletClient);
};

// CONFIG DEFAULTS

/**
 * Applies the config's ACP permit defaults to creation options (pure).
 * Explicit user options always win:
 *  - validator: injected only when the options carry NO validator pair —
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
    // Creation timestamp minus a clock-skew allowance: the validator rejects
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

// REVOKE (on-chain, via the permit's validator contract)

/**
 * Revoke a single permit on-chain via its validator contract.
 * Only the permit's issuer can revoke it (enforced by the validator: revocations
 * are keyed by msg.sender). The permit stays in local storage — on-chain
 * validation will reject it from the next block onwards.
 *
 * @returns the revocation transaction hash
 */
const revokePermit = async (permit: Permit, walletClient: WalletClient): Promise<Hex> => {
  if (permit.revokerContract === zeroAddress || permit.revokerData === 0) {
    throw new Error('Permit is not revocable: it has no validator (revokerContract/revokerData unset)');
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
 * a single threshold write on the validator). Permits created after this
 * transaction remain valid.
 *
 * @param revokerContract - the validator to revoke against (defaults to the
 *   connected account's active permit's validator when omitted)
 * @returns the revocation transaction hash
 */
const revokeAllPermits = async (
  walletClient: WalletClient,
  publicClient: PublicClient,
  revokerContract?: Hex
): Promise<Hex> => {
  if (walletClient.account == null) throw new Error('Missing walletClient account');

  let validator = revokerContract;
  if (validator == null) {
    const chainId = await publicClient.getChainId();
    const active = getActivePermit(chainId, walletClient.account.address);
    validator = active?.revokerContract;
  }
  if (validator == null || validator === zeroAddress) {
    throw new Error('No validator contract: pass `revokerContract` or activate a revocable permit first');
  }

  return walletClient.writeContract({
    address: validator,
    abi: ACP_VALIDATOR_ABI,
    functionName: 'revokeAllExisting',
    args: [],
    account: walletClient.account,
    chain: walletClient.chain,
  });
};

/**
 * Check whether a permit has been revoked (or is otherwise disabled) by its
 * validator. Returns false for permits without a validator (not revocable).
 */
const isPermitRevoked = async (permit: Permit, publicClient: PublicClient): Promise<boolean> => {
  if (permit.revokerContract === zeroAddress || permit.revokerData === 0) return false;
  return publicClient.readContract({
    address: permit.revokerContract,
    abi: ACP_VALIDATOR_ABI,
    functionName: 'disabled',
    args: [permit.issuer, BigInt(permit.revokerData)],
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

  applyPermitDefaults,
};

/** @deprecated renamed — use `acp` (public terminology: permit -> ACP) */
export const acp = permits;
