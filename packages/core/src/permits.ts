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

const createSelf = async (options: CreateSelfPermitOptions) => {
  const publicClient = sdkStore.getPublicClient();
  if (!publicClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingPublicClient, message: 'Public client missing' });

  const walletClient = sdkStore.getWalletClient();
  if (!walletClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingWalletClient, message: 'Wallet client missing' });

  let permit: Permit;

  try {
    permit = await PermitUtils.createSelfAndSign(options, publicClient, walletClient);
  } catch (error) {
    throw InternalCofhesdkError(error);
  }

  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
  permitStore.setActivePermitHash(chainId, account, PermitUtils.getHash(permit));
};

const createSharing = async (options: CreateSharingPermitOptions) => {
  const publicClient = sdkStore.getPublicClient();
  if (!publicClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingPublicClient, message: 'Public client missing' });

  const walletClient = sdkStore.getWalletClient();
  if (!walletClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingWalletClient, message: 'Wallet client missing' });

  let permit: Permit;

  try {
    permit = await PermitUtils.createSharingAndSign(options, publicClient, walletClient);
  } catch (error) {
    throw InternalCofhesdkError(error);
  }

  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
  permitStore.setActivePermitHash(chainId, account, PermitUtils.getHash(permit));
};

const importShared = async (options: ImportSharedPermitOptions | any | string) => {
  const publicClient = sdkStore.getPublicClient();
  if (!publicClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingPublicClient, message: 'Public client missing' });

  const walletClient = sdkStore.getWalletClient();
  if (!walletClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingWalletClient, message: 'Wallet client missing' });

  let permit: Permit;

  try {
    permit = await PermitUtils.importSharedAndSign(options, publicClient, walletClient);
  } catch (error) {
    throw InternalCofhesdkError(error);
  }

  const chainId = await publicClient.getChainId();
  const account = walletClient.account!.address;

  permitStore.setPermit(chainId, account, permit);
  permitStore.setActivePermitHash(chainId, account, PermitUtils.getHash(permit));
};

export const permits = {
  createSelf,
  createSharing,
  importShared,
};
