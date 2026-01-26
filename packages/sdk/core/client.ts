import type { CreateSelfPermitOptions, CreateSharingPermitOptions, ImportSharedPermitOptions } from '@/permits';

import { createStore } from 'zustand/vanilla';
import { type PublicClient, type WalletClient } from 'viem';
import { CofhesdkError, CofhesdkErrorCode } from './error.js';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
import { createKeysStore } from './keyStore.js';
import { permits } from './permits.js';
import { DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder.js';
import { getPublicClientChainID, getWalletClientAccount } from './utils.js';
import type {
  CofhesdkClientConnectionState,
  CofhesdkClientParams,
  CofhesdkClient,
  CofhesdkClientPermits,
} from './clientTypes.js';
import type { EncryptableItem, FheTypes } from './types.js';
import type { CofhesdkConfig } from './config.js';

export const InitialConnectStore: CofhesdkClientConnectionState = {
  connected: false,
  connecting: false,
  connectError: undefined,
  chainId: undefined,
  account: undefined,
  publicClient: undefined,
  walletClient: undefined,
};

/**
 * Creates a CoFHE SDK client instance (base implementation)
 * @param {CofhesdkClientParams} opts - Initialization options including config and platform-specific serializers
 * @returns {CofhesdkClient} - The CoFHE SDK client instance
 */
export function createCofhesdkClientBase<TConfig extends CofhesdkConfig>(
  opts: CofhesdkClientParams<TConfig>
): CofhesdkClient<TConfig> {
  // Create keysStorage instance using configured storage
  const keysStorage = createKeysStore(opts.config.fheKeyStorage);

  // Zustand store for reactive state management

  const connectStore = createStore<CofhesdkClientConnectionState>(() => InitialConnectStore);

  // Helper to update state
  const updateConnectState = (partial: Partial<CofhesdkClientConnectionState>) => {
    connectStore.setState((state) => ({ ...state, ...partial }));
  };

  // Called before any operation, throws of connection not yet established
  const _requireConnected = () => {
    const state = connectStore.getState();
    const notConnected =
      !state.connected || !state.account || !state.chainId || !state.publicClient || !state.walletClient;
    if (notConnected) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.NotConnected,
        message: 'Client must be connected, account and chainId must be initialized',
        hint: 'Ensure client.connect() has been called and awaited.',
        context: {
          connected: state.connected,
          account: state.account,
          chainId: state.chainId,
          publicClient: state.publicClient,
          walletClient: state.walletClient,
        },
      });
    }
  };

  // LIFECYCLE

  async function connect(publicClient: PublicClient, walletClient: WalletClient) {
    const state = connectStore.getState();

    // Exit if already connected and clients are the same
    if (state.connected && state.publicClient === publicClient && state.walletClient === walletClient) return;

    // Set connecting state
    updateConnectState({
      ...InitialConnectStore,
      connecting: true,
    });

    // Fetch chainId and account
    try {
      const chainId = await getPublicClientChainID(publicClient);
      const account = await getWalletClientAccount(walletClient);
      updateConnectState({
        connected: true,
        connecting: false,
        connectError: undefined,
        chainId,
        account,
        publicClient,
        walletClient,
      });
    } catch (e) {
      updateConnectState({
        ...InitialConnectStore,
        connectError: e,
      });
      throw e;
    }
  }

  // CLIENT OPERATIONS

  function encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilder<[...T]> {
    const state = connectStore.getState();

    return new EncryptInputsBuilder({
      inputs,
      account: state.account ?? undefined,
      chainId: state.chainId ?? undefined,

      config: opts.config,
      publicClient: state.publicClient ?? undefined,
      walletClient: state.walletClient ?? undefined,
      zkvWalletClient: opts.config._internal?.zkvWalletClient,

      tfhePublicKeyDeserializer: opts.tfhePublicKeyDeserializer,
      compactPkeCrsDeserializer: opts.compactPkeCrsDeserializer,
      zkBuilderAndCrsGenerator: opts.zkBuilderAndCrsGenerator,
      initTfhe: opts.initTfhe,
      zkProveWorkerFn: opts.zkProveWorkerFn,

      keysStorage,

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
      publicClient: state.publicClient ?? undefined,
      walletClient: state.walletClient ?? undefined,

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
    createSelf: async (options: CreateSelfPermitOptions, clients?: { publicClient: PublicClient; walletClient: WalletClient }) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      return permits.createSelf(options, publicClient!, walletClient!);
    },

    createSharing: async (options: CreateSharingPermitOptions, clients?: { publicClient: PublicClient; walletClient: WalletClient }) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      return permits.createSharing(options, publicClient!, walletClient!);
    },

    importShared: async (options: ImportSharedPermitOptions | any | string, clients?: { publicClient: PublicClient; walletClient: WalletClient }) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      return permits.importShared(options, publicClient!, walletClient!);
    },

    // Get or create methods (require connection)
    getOrCreateSelfPermit: async (chainId?: number, account?: string, options?: CreateSelfPermitOptions) => {
      _requireConnected();
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      const { publicClient, walletClient } = connectStore.getState();
      return permits.getOrCreateSelfPermit(publicClient!, walletClient!, _chainId, _account, options);
    },

    getOrCreateSharingPermit: async (options: CreateSharingPermitOptions, chainId?: number, account?: string) => {
      _requireConnected();
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      const { publicClient, walletClient } = connectStore.getState();
      return permits.getOrCreateSharingPermit(publicClient!, walletClient!, options, _chainId, _account);
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

    removePermit: async (hash: string, chainId?: number, account?: string, force?: boolean) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.removePermit(_chainId, _account, hash, force);
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
    //   // Use state.publicClient and state.walletClient for implementation
    // },
  };
}
