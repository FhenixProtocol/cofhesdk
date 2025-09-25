/* eslint-disable no-unused-vars */
import {
  ImportSharedPermitOptions,
  PermitUtils,
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  Permit,
  permitStore,
} from '@cofhesdk/permits';
import { sdkStore } from './sdkStore';
import { CofhesdkError, CofhesdkErrorCode, InternalCofhesdkError } from './result';
import { PublicClient, WalletClient } from 'viem';

// HELPERS

// Helper function to validate and get clients
const getValidatedClients = () => {
  const publicClient = sdkStore.getPublicClient();
  if (!publicClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingPublicClient, message: 'Public client missing' });

  const walletClient = sdkStore.getWalletClient();
  if (!walletClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingWalletClient, message: 'Wallet client missing' });

  return { publicClient, walletClient };
};

// Helper function to store permit as active permit
const storeActivePermit = async (permit: Permit, publicClient: any, walletClient: any) => {
  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
  permitStore.setActivePermitHash(chainId, account, PermitUtils.getHash(permit));
};

// Helper to resolve context with defaults
const resolveContext = async (chainId?: number, account?: string) => {
  const { publicClient, walletClient } = getValidatedClients();
  const resolvedChainId = chainId ?? (await publicClient.getChainId());
  const resolvedAccount = account ?? walletClient.account!.address;
  return { resolvedChainId, resolvedAccount };
};

// Generic function to handle permit creation with error handling
const createPermitWithSign = async <T>(
  options: T,
  permitMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<Permit>
) => {
  const { publicClient, walletClient } = getValidatedClients();

  let permit: Permit;
  try {
    permit = await permitMethod(options, publicClient, walletClient);
  } catch (error) {
    throw InternalCofhesdkError(error);
  }

  await storeActivePermit(permit, publicClient, walletClient);

  return permit;
};

// CREATE

const createSelf = async (options: CreateSelfPermitOptions) => {
  return createPermitWithSign(options, PermitUtils.createSelfAndSign);
};

const createSharing = async (options: CreateSharingPermitOptions) => {
  return createPermitWithSign(options, PermitUtils.createSharingAndSign);
};

const importShared = async (options: ImportSharedPermitOptions | any | string) => {
  return createPermitWithSign(options, PermitUtils.importSharedAndSign);
};

// GET

const getPermit = async ({ chainId, account, hash }: { chainId?: number; account?: string; hash: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  return permitStore.getPermit(resolvedChainId, resolvedAccount, hash);
};

const getPermits = async ({ chainId, account }: { chainId?: number; account?: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  return permitStore.getPermits(resolvedChainId, resolvedAccount);
};

const getActivePermit = async ({ chainId, account }: { chainId?: number; account?: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  return permitStore.getActivePermit(resolvedChainId, resolvedAccount);
};

const getActivePermitHash = async ({ chainId, account }: { chainId?: number; account?: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  return permitStore.getActivePermitHash(resolvedChainId, resolvedAccount);
};

const selectActivePermit = async ({ chainId, account, hash }: { chainId?: number; account?: string; hash: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  const permit = await permitStore.setActivePermitHash(resolvedChainId, resolvedAccount, hash);
  return permit;
};

// REMOVE

const removePermit = async ({ chainId, account, hash }: { chainId?: number; account?: string; hash: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  await permitStore.removePermit(resolvedChainId, resolvedAccount, hash);
};

const removeActivePermit = async ({ chainId, account }: { chainId?: number; account?: string }) => {
  const { resolvedChainId, resolvedAccount } = await resolveContext(chainId, account);
  await permitStore.removeActivePermitHash(resolvedChainId, resolvedAccount);
};

// EXPORT

export const permits = {
  createSelf,
  createSharing,
  importShared,

  getPermit,
  getPermits,
  getActivePermit,
  getActivePermitHash,
  removePermit,
  selectActivePermit,
  removeActivePermit,
};
