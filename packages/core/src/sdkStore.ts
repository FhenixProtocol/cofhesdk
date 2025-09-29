import { createStore } from 'zustand/vanilla';
import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { CofhesdkError, CofhesdkErrorCode } from './error';

type SdkStore = {
  config: CofhesdkConfig | null;
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;
};

const store = createStore<SdkStore>()(() => ({
  config: null,
  publicClient: null,
  walletClient: null,
}));

const getConfig = (): CofhesdkConfig | null => {
  return store.getState().config;
};

const getPublicClient = (): PublicClient | null => {
  return store.getState().publicClient;
};

const getWalletClient = (): WalletClient | null => {
  return store.getState().walletClient;
};

const getZkvWalletClient = (): WalletClient | null => {
  return store.getState().config?._internal?.zkvWalletClient ?? null;
};

const setConfig = (config: CofhesdkConfig) => {
  store.setState({ config });
};

const setPublicClient = (publicClient: PublicClient) => {
  store.setState({ publicClient });
};

const setWalletClient = (walletClient: WalletClient) => {
  store.setState({ walletClient });
};

const clearSdkStore = () => {
  store.setState({ config: null, publicClient: null, walletClient: null });
};

// Validated

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

// Barrel

export const sdkStore = {
  store,

  getConfig,
  getPublicClient,
  getWalletClient,
  getZkvWalletClient,

  setConfig,
  setPublicClient,
  setWalletClient,

  clearSdkStore,

  getValidatedClients,
};
