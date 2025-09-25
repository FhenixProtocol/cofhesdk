import { createStore } from 'zustand/vanilla';
import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';

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

export const sdkStore = {
  store,

  getConfig,
  getPublicClient,
  getWalletClient,

  setConfig,
  setPublicClient,
  setWalletClient,

  clearSdkStore,
};
