/* eslint-disable no-unused-vars */
import { CofhesdkError, CofhesdkErrorCode } from './error';
import {
  ImportSharedPermitOptions,
  PermitUtils,
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  Permit,
  permitStore,
  SerializedPermit,
} from '@cofhesdk/permits';
import { sdkStore } from './sdkStore';
import { Result, resultWrapper } from './result';
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
const resolveContext = async (options?: GetPermitsOptions) => {
  const { chainId, account } = options ?? {};
  const { publicClient, walletClient } = getValidatedClients();
  const resolvedChainId = chainId ?? (await publicClient.getChainId());
  const resolvedAccount = account ?? walletClient.account!.address;
  return { resolvedChainId, resolvedAccount };
};

// Generic function to handle permit creation with error handling
const createPermitWithSign = async <T>(
  options: T,
  permitMethod: (options: T, publicClient: PublicClient, walletClient: WalletClient) => Promise<Permit>
): Promise<Result<Permit>> => {
  return resultWrapper(async () => {
    const { publicClient, walletClient } = getValidatedClients();
    const permit = await permitMethod(options, publicClient, walletClient);
    await storeActivePermit(permit, publicClient, walletClient);
    return permit;
  });
};

// CREATE

/**
 * Create a permit usable by the connected user
 * Stores the permit and selects it as the active permit
 * @param options - The options for creating a self permit
 * @returns The created permit or error
 */
const createSelf = async (options: CreateSelfPermitOptions): Promise<Result<Permit>> => {
  return createPermitWithSign(options, PermitUtils.createSelfAndSign);
};

const createSharing = async (options: CreateSharingPermitOptions): Promise<Result<Permit>> => {
  return createPermitWithSign(options, PermitUtils.createSharingAndSign);
};

const importShared = async (options: ImportSharedPermitOptions | any | string): Promise<Result<Permit>> => {
  return createPermitWithSign(options, PermitUtils.importSharedAndSign);
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

type GetPermitsOptions = {
  chainId?: number;
  account?: string;
};

const getPermit = async (hash: string, options?: GetPermitsOptions): Promise<Result<Permit | undefined>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    return permitStore.getPermit(resolvedChainId, resolvedAccount, hash);
  });
};

const getPermits = async (options?: GetPermitsOptions): Promise<Result<Record<string, Permit>>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    return permitStore.getPermits(resolvedChainId, resolvedAccount);
  });
};

const getActivePermit = async (options?: GetPermitsOptions): Promise<Result<Permit | undefined>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    return permitStore.getActivePermit(resolvedChainId, resolvedAccount);
  });
};

const getActivePermitHash = async (options?: GetPermitsOptions): Promise<Result<string | undefined>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    return permitStore.getActivePermitHash(resolvedChainId, resolvedAccount);
  });
};

const selectActivePermit = async (hash: string, options?: GetPermitsOptions): Promise<Result<void>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    await permitStore.setActivePermitHash(resolvedChainId, resolvedAccount, hash);
  });
};

// REMOVE

const removePermit = async (hash: string, options?: GetPermitsOptions): Promise<Result<void>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    await permitStore.removePermit(resolvedChainId, resolvedAccount, hash);
  });
};

const removeActivePermit = async (options?: GetPermitsOptions): Promise<Result<void>> => {
  return resultWrapper(async () => {
    const { resolvedChainId, resolvedAccount } = await resolveContext(options);
    await permitStore.removeActivePermitHash(resolvedChainId, resolvedAccount);
  });
};

// EXPORT

export const permits = {
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
