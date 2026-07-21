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

import { type PublicClient, type WalletClient } from 'viem';

// HELPERS

// Store a permit without changing which permit is active.
const storePermit = async (permit: Permit, publicClient: any, walletClient: any) => {
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
};

// Store a permit AND select it as the active permit.
const storeActivePermit = async (permit: Permit, publicClient: any, walletClient: any) => {
  await storePermit(permit, publicClient, walletClient);
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;
  permitStore.setActivePermitHash(chainId, account, permit.hash);
};

// Generic function to handle permit creation with error handling.
// `activate` controls whether the new permit becomes the issuer's active permit — true for
// self/imported permits (the connected user decrypts with them), false for sharing permits (those
// are delegated to a recipient and are never the issuer's own active permit).
const createPermitWithSign = async <T, TPermit extends Permit>(
  options: T,
  publicClient: PublicClient,
  walletClient: WalletClient,
  permitMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<TPermit>,
  activate = true
): Promise<TPermit> => {
  const permit = await permitMethod(options, publicClient, walletClient);
  if (activate) {
    await storeActivePermit(permit, publicClient, walletClient);
  } else {
    await storePermit(permit, publicClient, walletClient);
  }
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
  // A sharing permit is delegated to a recipient — it is never the issuer's own active permit, so
  // creating one only stores it (unlike self/imported permits, which activate).
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.createSharingAndSign, false);
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
};
