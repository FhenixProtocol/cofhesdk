/* eslint-disable no-unused-vars */
import { createStore } from 'zustand/vanilla';
import { PublicClient, WalletClient } from 'viem';
import { fetchMultichainKeys } from './fetchKeys';
import { CofhesdkError, CofhesdkErrorCode } from './error';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder';
import { Result, ResultOk, resultWrapper } from './result';
import { keysStorage } from './keyStore';
import { permits } from './permits';
import type { CreateSelfPermitOptions, CreateSharingPermitOptions, ImportSharedPermitOptions } from '@cofhesdk/permits';
import { DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder';
import {
  CofhesdkClient,
  CofhesdkClientParams,
  CofhesdkClientConnectionState,
  EncryptableItem,
  FheTypes,
  CofhesdkClientPermits,
} from './types';
import { getPublicClientChainID, getWalletClientAccount } from './utils';

/**
 * Creates a CoFHE SDK client instance
 * @param {CofhesdkClientParams} opts - Initialization options including config and platform-specific serializers
 * @returns {CofhesdkClient} - The CoFHE SDK client instance
 */
export function createCofhesdkClient(opts: CofhesdkClientParams): CofhesdkClient {
  // refs captured in closure
  let _publicClient: PublicClient | undefined = undefined;
  let _walletClient: WalletClient | undefined = undefined;

  // Zustand store for reactive state management
  const connectStore = createStore<CofhesdkClientConnectionState>(() => ({
    connected: false,
    connecting: false,
    connectError: undefined,
    chainId: undefined,
    account: undefined,
  }));

  // Helper to update state
  const updateConnectState = (partial: Partial<CofhesdkClientConnectionState>) => {
    connectStore.setState((state) => ({ ...state, ...partial }));
  };

  // single-flight + abortable warmup
  let _connectPromise: Promise<Result<boolean>> | undefined = undefined;

  // Called before any operation, throws of connection not yet established
  const _requireConnected = () => {
    const state = connectStore.getState();
    const notConnected = !state.connected || !_publicClient || !_walletClient || !state.account || !state.chainId;
    if (notConnected) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotConnected,
        message: 'Client must be connected, account and chainId must be initialized',
        hint: 'Ensure client.connect() has been called and awaited.',
        context: {
          connected: state.connected,
          account: state.account,
          chainId: state.chainId,
          publicClient: _publicClient,
          walletClient: _walletClient,
        },
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

  // LIFECYCLE

  async function connect(publicClient: PublicClient, walletClient: WalletClient) {
    const state = connectStore.getState();

    // Exit if already connected and clients are the same
    if (state.connected && _publicClient === publicClient && _walletClient === walletClient) {
      return Promise.resolve(ResultOk(true));
    }

    // Exit if already connecting
    if (_connectPromise && _publicClient === publicClient && _walletClient === walletClient) {
      return _connectPromise;
    }

    // Set connecting state
    updateConnectState({ connecting: true, connectError: null, connected: false });

    _connectPromise = resultWrapper(
      // try
      async () => {
        _publicClient = publicClient;
        _walletClient = walletClient;

        const chainId = await getPublicClientChainID(publicClient);
        const account = await getWalletClientAccount(walletClient);

        updateConnectState({ connecting: false, connected: true, chainId, account });

        return true;
      },
      // catch
      (e) => {
        updateConnectState({ connecting: false, connected: false, connectError: e });
        return false;
      },
      // finally
      () => {
        _connectPromise = undefined;
      }
    );

    return _connectPromise;
  }

  // CLIENT OPERATIONS

  function encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilder<[...T]> {
    const state = connectStore.getState();

    return new EncryptInputsBuilder({
      inputs,
      account: state.account ?? undefined,
      chainId: state.chainId ?? undefined,

      config: opts.config,
      publicClient: _publicClient ?? undefined,
      walletClient: _walletClient ?? undefined,
      zkvWalletClient: opts.config._internal?.zkvWalletClient,

      tfhePublicKeySerializer: opts.tfhePublicKeySerializer,
      compactPkeCrsSerializer: opts.compactPkeCrsSerializer,
      zkBuilderAndCrsGenerator: opts.zkBuilderAndCrsGenerator,
      initTfhe: opts.initTfhe,

      requireConnected: _requireConnected,
    });
  }

  function decryptHandle<U extends FheTypes>(ctHash: bigint, utype: U): DecryptHandlesBuilder<U> {
    const state = connectStore.getState();

    return new DecryptHandlesBuilder({
      ctHash,
      utype,
      chainId: state.chainId ?? undefined,
      account: state.account ?? undefined,

      config: opts.config,
      publicClient: _publicClient ?? undefined,
      walletClient: _walletClient ?? undefined,

      requireConnected: _requireConnected,
    });
  }

  // PERMITS - Context-aware wrapper

  const _getChainIdAndAccount = (chainId?: number, account?: string) => {
    const state = connectStore.getState();
    const _chainId = chainId ?? state.chainId;
    const _account = account ?? state.account;

    if (_chainId == null || _account == null) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotConnected,
        message: 'ChainId or account not available.',
        hint: 'Ensure client.connect() has been called, or provide chainId and account explicitly.',
        context: {
          chainId: _chainId,
          account: _account,
        },
      });
    }

    return { chainId: _chainId, account: _account };
  };

  const clientPermits: CofhesdkClientPermits = {
    // Pass through store access
    getSnapshot: permits.getSnapshot,
    subscribe: permits.subscribe,

    // Creation methods (require connection)
    createSelf: async (options: CreateSelfPermitOptions) =>
      resultWrapper(async () => {
        _requireConnected();
        return permits.createSelf(options, _publicClient!, _walletClient!);
      }),

    createSharing: async (options: CreateSharingPermitOptions) =>
      resultWrapper(async () => {
        _requireConnected();
        return permits.createSharing(options, _publicClient!, _walletClient!);
      }),

    importShared: async (options: ImportSharedPermitOptions | any | string) =>
      resultWrapper(async () => {
        _requireConnected();
        return permits.importShared(options, _publicClient!, _walletClient!);
      }),

    // Retrieval methods (auto-fill chainId/account)
    getPermit: async (hash: string, chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.getPermit(_chainId, _account, hash);
      }),

    getPermits: async (chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.getPermits(_chainId, _account);
      }),

    getActivePermit: async (chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.getActivePermit(_chainId, _account);
      }),

    getActivePermitHash: async (chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.getActivePermitHash(_chainId, _account);
      }),

    // Mutation methods (auto-fill chainId/account)
    selectActivePermit: async (hash: string, chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.selectActivePermit(_chainId, _account, hash);
      }),

    removePermit: async (hash: string, chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.removePermit(_chainId, _account, hash);
      }),

    removeActivePermit: async (chainId?: number, account?: string) =>
      resultWrapper(async () => {
        const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
        return permits.removeActivePermit(_chainId, _account);
      }),

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
    decryptHandle,
    permits: clientPermits,

    // Add SDK-specific methods below that require connection
    // Example:
    // async encryptData(data: unknown) {
    //   requireConnected();
    //   // Use _publicClient and _walletClient for implementation
    // },
  };
}
