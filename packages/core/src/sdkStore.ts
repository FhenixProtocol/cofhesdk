import { createStore } from 'zustand/vanilla';
import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { CofhesdkError, CofhesdkErrorCode } from './error';
import { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify';
import { FheKeySerializer } from './fetchKeys';

type SdkStore = {
  config: CofhesdkConfig | null;
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;

  // Platform specific
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator | null;
  tfhePublicKeySerializer: FheKeySerializer | null;
  compactPkeCrsSerializer: FheKeySerializer | null;
};

const store = createStore<SdkStore>()(() => ({
  config: null,
  publicClient: null,
  walletClient: null,

  // Platform specific
  zkBuilderAndCrsGenerator: null,
  tfhePublicKeySerializer: null,
  compactPkeCrsSerializer: null,
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

const setZkBuilderAndCrsGenerator = (zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator) => {
  store.setState({ zkBuilderAndCrsGenerator });
};

const getZkBuilderAndCrsGenerator = () => {
  return store.getState().zkBuilderAndCrsGenerator;
};

const setTfhePublicKeySerializer = (tfhePublicKeySerializer: FheKeySerializer) => {
  store.setState({ tfhePublicKeySerializer });
};

const setCompactPkeCrsSerializer = (compactPkeCrsSerializer: FheKeySerializer) => {
  store.setState({ compactPkeCrsSerializer });
};

const getTfhePublicKeySerializer = () => {
  return store.getState().tfhePublicKeySerializer;
};

const getCompactPkeCrsSerializer = () => {
  return store.getState().compactPkeCrsSerializer;
};

const clearSdkStore = () => {
  store.setState({ config: null, publicClient: null, walletClient: null });
};

// Validated

// Fetch public and wallet clients, throw if missing
const getValidatedClients = () => {
  const publicClient = sdkStore.getPublicClient();
  if (!publicClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingPublicClient, message: 'Public client missing' });

  const walletClient = sdkStore.getWalletClient();
  if (!walletClient)
    throw new CofhesdkError({ code: CofhesdkErrorCode.MissingWalletClient, message: 'Wallet client missing' });

  return { publicClient, walletClient };
};

// Fetch supported chain config, throw if missing
const getSupportedChainConfig = (chainId: number) => {
  const config = sdkStore.getConfig();
  if (!config) throw new CofhesdkError({ code: CofhesdkErrorCode.MissingConfig, message: 'Config missing' });
  const supportedChainConfig = config.supportedChains.find((chain) => chain.id === chainId);
  if (!supportedChainConfig)
    throw new CofhesdkError({ code: CofhesdkErrorCode.UnsupportedChain, message: 'Unsupported chain' });
  return supportedChainConfig;
};

// Barrel

export const sdkStore = {
  store,

  getConfig,
  getPublicClient,
  getWalletClient,
  getZkvWalletClient,
  getZkBuilderAndCrsGenerator,
  getTfhePublicKeySerializer,
  getCompactPkeCrsSerializer,

  setConfig,
  setPublicClient,
  setWalletClient,
  setZkBuilderAndCrsGenerator,
  setTfhePublicKeySerializer,
  setCompactPkeCrsSerializer,

  clearSdkStore,

  getValidatedClients,
  getSupportedChainConfig,
};
