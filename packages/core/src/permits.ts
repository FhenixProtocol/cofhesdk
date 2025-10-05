/* eslint-disable no-unused-vars */
import {
  ImportSharedPermitOptions,
  PermitUtils,
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  Permit,
  permitStore,
  SerializedPermit,
} from '@cofhesdk/permits';
import { PublicClient, WalletClient } from 'viem';

// HELPERS

// Helper function to store permit as active permit
const storeActivePermit = async (permit: Permit, publicClient: any, walletClient: any) => {
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
  permitStore.setActivePermitHash(chainId, account, PermitUtils.getHash(permit));
};

// Generic function to handle permit creation with error handling
const createPermitWithSign = async <T>(
  options: T,
  publicClient: PublicClient,
  walletClient: WalletClient,
  permitMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<Permit>
): Promise<Permit> => {
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
): Promise<Permit> => {
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.createSelfAndSign);
};

const createSharing = async (
  options: CreateSharingPermitOptions,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<Permit> => {
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.createSharingAndSign);
};

const importShared = async (
  options: ImportSharedPermitOptions | any | string,
  publicClient: PublicClient,
  walletClient: WalletClient
): Promise<Permit> => {
  return createPermitWithSign(options, publicClient, walletClient, PermitUtils.importSharedAndSign);
};

// PERMIT UTILS

const getHash = (permit: Permit) => {
  return PermitUtils.getHash(permit);
};

const serialize = (permit: Permit) => {
  return PermitUtils.serialize(permit);
};

const deserialize = (serialized: SerializedPermit) => {
  return PermitUtils.deserialize(serialized);
};

// GET

const getPermit = async (chainId: number, account: string, hash: string): Promise<Permit | undefined> => {
  return permitStore.getPermit(chainId, account, hash);
};

const getPermits = async (chainId: number, account: string): Promise<Record<string, Permit>> => {
  return permitStore.getPermits(chainId, account);
};

const getActivePermit = async (chainId: number, account: string): Promise<Permit | undefined> => {
  return permitStore.getActivePermit(chainId, account);
};

const getActivePermitHash = async (chainId: number, account: string): Promise<string | undefined> => {
  return permitStore.getActivePermitHash(chainId, account);
};

const selectActivePermit = async (chainId: number, account: string, hash: string): Promise<void> => {
  await permitStore.setActivePermitHash(chainId, account, hash);
};

// REMOVE

const removePermit = async (chainId: number, account: string, hash: string): Promise<void> => {
  await permitStore.removePermit(chainId, account, hash);
};

const removeActivePermit = async (chainId: number, account: string): Promise<void> => {
  await permitStore.removeActivePermitHash(chainId, account);
};

// EXPORT

export const permits = {
  getSnapshot: permitStore.store.getState,
  subscribe: permitStore.store.subscribe,

  createSelf,
  createSharing,
  importShared,

  getHash,
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
