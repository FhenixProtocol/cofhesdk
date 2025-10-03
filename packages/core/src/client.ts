/* eslint-disable no-unused-vars */
import { createStore } from 'zustand/vanilla';
import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { fetchMultichainKeys, FheKeySerializer } from './fetchKeys';
import { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify';
import { CofhesdkError, CofhesdkErrorCode } from './error';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder';
import { Result, ResultOk, resultWrapper } from './result';
import { keysStorage } from './keyStore';
import { permits } from './permits';
import type {
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
  Permit,
} from '@cofhesdk/permits';
import { PermitUtils } from '@cofhesdk/permits';

export type ConnectStateSnapshot = {
  connected: boolean;
  connecting: boolean;
  connectError: unknown | null;
  chainId: number | null;
  address: string | null;
};

type Listener = (snapshot: ConnectStateSnapshot) => void;

type CofhesdkClientParams = {
  config: CofhesdkConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeySerializer: FheKeySerializer;
  compactPkeCrsSerializer: FheKeySerializer;
};

export type ClientPermits = {
  getSnapshot: typeof permits.getSnapshot;
  subscribe: typeof permits.subscribe;

  // Creation methods (require connection, no params)
  createSelf: (options: CreateSelfPermitOptions) => Promise<Result<Permit>>;
  createSharing: (options: CreateSharingPermitOptions) => Promise<Result<Permit>>;
  importShared: (options: ImportSharedPermitOptions | any | string) => Promise<Result<Permit>>;

  // Retrieval methods (chainId/account optional)
  getPermit: (hash: string, chainId?: number, account?: string) => Promise<Result<Permit | undefined>>;
  getPermits: (chainId?: number, account?: string) => Promise<Result<Record<string, Permit>>>;
  getActivePermit: (chainId?: number, account?: string) => Promise<Result<Permit | undefined>>;
  getActivePermitHash: (chainId?: number, account?: string) => Promise<Result<string | undefined>>;

  // Mutation methods (chainId/account optional)
  selectActivePermit: (hash: string, chainId?: number, account?: string) => Promise<Result<void>>;
  removePermit: (hash: string, chainId?: number, account?: string) => Promise<Result<void>>;
  removeActivePermit: (chainId?: number, account?: string) => Promise<Result<void>>;

  // Utils
  getHash: typeof PermitUtils.getHash;
  serialize: typeof PermitUtils.serialize;
  deserialize: typeof PermitUtils.deserialize;
};

export type CofhesdkClient = {
  // --- state access ---
  getSnapshot(): ConnectStateSnapshot;
  subscribe(listener: Listener): () => void;

  // --- initialization results ---
  // (functions that may be run during initialization based on config)
  readonly initializationResults: {
    keyFetchResult: Promise<Result<boolean>>;
  };

  // --- convenience flags (read-only) ---
  readonly connected: boolean;
  readonly connecting: boolean;

  // --- config & platform-specific ---
  readonly config: CofhesdkConfig;

  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<Result<boolean>>;
  encryptInputs<T extends any[]>(inputs: [...T]): Promise<EncryptInputsBuilder<[...T]>>;
  permits: ClientPermits;
};

/**
 * Creates a CoFHE SDK client instance
 * @param {CofhesdkClientParams} opts - Initialization options including config and platform-specific serializers
 * @returns {CofhesdkClient} - The CoFHE SDK client instance
 */
export function createCofhesdkClient(opts: CofhesdkClientParams): CofhesdkClient {
  // refs captured in closure
  let _publicClient: PublicClient | null = null;
  let _walletClient: WalletClient | null = null;

  // Zustand store for reactive state management
  const connectStore = createStore<ConnectStateSnapshot>(() => ({
    connected: false,
    connecting: false,
    connectError: null,
    chainId: null,
    address: null,
  }));

  // Helper to update state
  const updateConnectState = (partial: Partial<ConnectStateSnapshot>) => {
    connectStore.setState((state) => ({ ...state, ...partial }));
  };

  // single-flight + abortable warmup
  let _connectPromise: Promise<Result<boolean>> | null = null;

  const _requireConnected = () => {
    const state = connectStore.getState();
    if (!state.connected || !_publicClient || !_walletClient) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotInitialized,
        message: 'Not connected. Call connect() first.',
      });
    }
    if (!state.address) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotInitialized,
        message: 'Address is not initialized. Call connect() first.',
      });
    }
    if (!state.chainId) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotInitialized,
        message: 'Chain ID is not initialized. Call connect() first.',
      });
    }
  };

  // INITIALIZATION

  const keyFetchResult = resultWrapper(async () => {
    // Hydrate keyStore
    await keysStorage.rehydrateKeysStore();

    // If configured, fetch keys for all supported chains
    if (opts.config.fheKeysPrefetching === 'SUPPORTED_CHAINS') {
      await fetchMultichainKeys(opts.config, 0, opts.tfhePublicKeySerializer, opts.compactPkeCrsSerializer);
      return true;
    }

    return false;
  });

  const generatePermitResult = resultWrapper(async () => {
    if (opts.config.permitGeneration !== 'ON_CONNECT') return false;
    // TODO: Generate permit if not generated or not valid
    return true;
  });

  // LIFECYCLE

  async function connect(publicClient: PublicClient, walletClient: WalletClient) {
    const state = connectStore.getState();

    // Exit if already connected and clients are the same
    if (state.connected && _publicClient === publicClient && _walletClient === walletClient)
      return Promise.resolve(ResultOk(true));

    // Exit if already connecting
    if (_connectPromise) return _connectPromise;

    // Set connecting state
    updateConnectState({ connecting: true, connectError: null, connected: false });

    _connectPromise = resultWrapper(
      // try
      async () => {
        _publicClient = publicClient;
        _walletClient = walletClient;

        const chainId = await _getChainId(publicClient);
        const addresses = await _getAddresses(walletClient);

        updateConnectState({ connecting: false, connected: true, chainId, address: addresses[0] });

        return true;
      },
      // catch
      (e) => {
        updateConnectState({ connecting: false, connected: false, connectError: e });
      },
      // finally
      () => {
        _connectPromise = null;
      }
    );

    return _connectPromise;
  }

  // CLIENT OPERATIONS

  async function encryptInputs<T extends any[]>(inputs: [...T]): Promise<EncryptInputsBuilder<[...T]>> {
    _requireConnected();

    const state = connectStore.getState();

    return new EncryptInputsBuilder({
      inputs,
      sender: state.address!,
      chainId: state.chainId!,

      config: opts.config,
      publicClient: _publicClient ?? undefined,
      walletClient: _walletClient ?? undefined,
      zkvWalletClient: opts.config._internal?.zkvWalletClient,

      tfhePublicKeySerializer: opts.tfhePublicKeySerializer,
      compactPkeCrsSerializer: opts.compactPkeCrsSerializer,
      zkBuilderAndCrsGenerator: opts.zkBuilderAndCrsGenerator,
    });
  }

  // PERMITS - Context-aware wrapper

  const _getChainIdAndAccount = (chainId?: number, account?: string) => {
    const state = connectStore.getState();
    const _chainId = chainId ?? state.chainId;
    const _account = account ?? state.address;

    if (_chainId == null || _account == null) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotInitialized,
        message: 'ChainId or account not available. Connect first or provide explicitly.',
      });
    }

    return { chainId: _chainId, account: _account };
  };

  const clientPermits: ClientPermits = {
    // Pass through store access
    getSnapshot: permits.getSnapshot,
    subscribe: permits.subscribe,

    // Creation methods (require connection)
    createSelf: async (options: CreateSelfPermitOptions) => {
      _requireConnected();
      return permits.createSelf(options, _publicClient!, _walletClient!);
    },

    createSharing: async (options: CreateSharingPermitOptions) => {
      _requireConnected();
      return permits.createSharing(options, _publicClient!, _walletClient!);
    },

    importShared: async (options: ImportSharedPermitOptions | any | string) => {
      _requireConnected();
      return permits.importShared(options, _publicClient!, _walletClient!);
    },

    // Retrieval methods (auto-fill chainId/account)
    getPermit: async (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getPermit(_chainId, _account, hash);
    },

    getPermits: async (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getPermits(_chainId, _account);
    },

    getActivePermit: async (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getActivePermit(_chainId, _account);
    },

    getActivePermitHash: async (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getActivePermitHash(_chainId, _account);
    },

    // Mutation methods (auto-fill chainId/account)
    selectActivePermit: async (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.selectActivePermit(_chainId, _account, hash);
    },

    removePermit: async (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.removePermit(_chainId, _account, hash);
    },

    removeActivePermit: async (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.removeActivePermit(_chainId, _account);
    },

    // Utils (no context needed)
    getHash: permits.getHash,
    serialize: permits.serialize,
    deserialize: permits.deserialize,
  };

  return {
    // Zustand reactive accessors (don't export store directly to prevent mutation)
    getSnapshot: connectStore.getState,
    subscribe: connectStore.subscribe,

    // initialization results
    initializationResults: {
      keyFetchResult,
    },

    // flags (read-only: reflect snapshot)
    get connected() {
      return connectStore.getState().connected;
    },
    get connecting() {
      return connectStore.getState().connecting;
    },

    // config & platform-specific (read-only)
    config: opts.config,

    connect,
    encryptInputs,
    permits: clientPermits,

    // Add SDK-specific methods below that require connection
    // Example:
    // async encryptData(data: unknown) {
    //   requireConnected();
    //   // Use _publicClient and _walletClient for implementation
    // },
  };
}

// Pure utility functions

async function _getChainId(publicClient: PublicClient) {
  let chainId: number | null = null;
  try {
    chainId = await publicClient.getChainId();
  } catch (e) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetChainIdFailed,
      message: 'connect(): publicClient.getChainId() failed',
      cause: e instanceof Error ? e : undefined,
    });
  }
  if (chainId === null) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetChainIdFailed,
      message: 'connect(): publicClient.getChainId() returned null',
    });
  }
  return chainId;
}

async function _getAddresses(walletClient: WalletClient) {
  let addresses: string[] = [];
  try {
    addresses = await walletClient.getAddresses();
  } catch (e) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetAddressesFailed,
      message: 'connect(): walletClient.getAddresses() failed',
      cause: e instanceof Error ? e : undefined,
    });
  }
  if (addresses.length === 0) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetAddressesFailed,
      message: 'connect(): walletClient.getAddresses() returned an empty array',
    });
  }
  return addresses;
}
