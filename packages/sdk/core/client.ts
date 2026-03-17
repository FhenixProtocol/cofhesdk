import type { CreateSelfPermitOptions, CreateSharingPermitOptions, ImportSharedPermitOptions } from '@/permits';

import { createStore } from 'zustand/vanilla';
import { type PublicClient, type WalletClient } from 'viem';
import { CofheError, CofheErrorCode } from './error.js';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
import { createKeysStore } from './keyStore.js';
import { permits } from './permits.js';
import { DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
import { DecryptForTxBuilder, type DecryptForTxBuilderUnset } from './decrypt/decryptForTxBuilder.js';
import { getPublicClientChainID, getWalletClientAccount } from './utils.js';
import type { CofheClientConnectionState, CofheClientParams, CofheClient, CofheClientPermits } from './clientTypes.js';
import type { EncryptableItem, FheTypes } from './types.js';
import type { CofheConfig } from './config.js';

export const InitialConnectStore: CofheClientConnectionState = {
  connected: false,
  connecting: false,
  connectError: undefined,
  chainId: undefined,
  account: undefined,
  publicClient: undefined,
  walletClient: undefined,
};

/**
 * Creates a CoFHE client instance (base implementation)
 * @param {CofheClientParams} opts - Initialization options including config and platform-specific serializers
 * @returns {CofheClient} - The CoFHE client instance
 */
export function createCofheClientBase<TConfig extends CofheConfig>(
  opts: CofheClientParams<TConfig>
): CofheClient<TConfig> {
  // Create keysStorage instance using configured storage
  const keysStorage = createKeysStore(opts.config.fheKeyStorage);

  // Zustand store for reactive state management

  const connectStore = createStore<CofheClientConnectionState>(() => InitialConnectStore);

  // Minimal cancellation mechanism: incremented on each connect/disconnect.
  // If a connect finishes after a disconnect, it must not overwrite the disconnected state.
  let connectAttemptId = 0;

  // Helper to update state
  const updateConnectState = (partial: Partial<CofheClientConnectionState>) => {
    connectStore.setState((state) => ({ ...state, ...partial }));
  };

  // Called before any operation, throws of connection not yet established
  const _requireConnected = () => {
    const state = connectStore.getState();
    const notConnected =
      !state.connected || !state.account || !state.chainId || !state.publicClient || !state.walletClient;
    if (notConnected) {
      throw new CofheError({
        code: CofheErrorCode.NotConnected,
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

    connectAttemptId += 1;
    const localAttemptId = connectAttemptId;

    // Set connecting state
    updateConnectState({
      ...InitialConnectStore,
      connecting: true,
    });

    // Fetch chainId and account
    try {
      const chainId = await getPublicClientChainID(publicClient);
      const account = await getWalletClientAccount(walletClient);

      // If a disconnect (or a newer connect) happened while awaiting, ignore this completion.
      if (localAttemptId !== connectAttemptId) return;

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
      // Ignore stale errors too.
      if (localAttemptId !== connectAttemptId) return;

      updateConnectState({
        ...InitialConnectStore,
        connectError: e,
      });
      throw e;
    }
  }

  function disconnect() {
    connectAttemptId += 1;
    updateConnectState({ ...InitialConnectStore });
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

  function decryptForView<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U> {
    const state = connectStore.getState();

    return new DecryptForViewBuilder({
      ctHash,
      utype,
      chainId: state.chainId,
      account: state.account,

      config: opts.config,
      publicClient: state.publicClient,
      walletClient: state.walletClient,

      requireConnected: _requireConnected,
    });
  }

  function decryptForTx(ctHash: bigint | string): DecryptForTxBuilderUnset {
    const state = connectStore.getState();

    return new DecryptForTxBuilder({
      ctHash,
      chainId: state.chainId,
      account: state.account,

      config: opts.config,
      publicClient: state.publicClient,
      walletClient: state.walletClient,

      requireConnected: _requireConnected,
    });
  }

  // PERMITS - Context-aware wrapper

  const _getChainIdAndAccount = (chainId?: number, account?: string) => {
    const state = connectStore.getState();
    const _chainId = chainId ?? state.chainId;
    const _account = account ?? state.account;

    if (_chainId == null || _account == null) {
      throw new CofheError({
        code: CofheErrorCode.NotConnected,
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

  const clientPermits: CofheClientPermits = {
    // Pass through store access
    getSnapshot: permits.getSnapshot,
    subscribe: permits.subscribe,

    // Creation methods (require connection)
    createSelf: async (
      options: CreateSelfPermitOptions,
      clients?: { publicClient: PublicClient; walletClient: WalletClient }
    ) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      return permits.createSelf(options, publicClient!, walletClient!);
    },

    createSharing: async (
      options: CreateSharingPermitOptions,
      clients?: { publicClient: PublicClient; walletClient: WalletClient }
    ) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      return permits.createSharing(options, publicClient!, walletClient!);
    },

    importShared: async (
      options: ImportSharedPermitOptions | string,
      clients?: { publicClient: PublicClient; walletClient: WalletClient }
    ) => {
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
    getPermit: (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getPermit(_chainId, _account, hash);
    },

    getPermits: (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getPermits(_chainId, _account);
    },

    getActivePermit: (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getActivePermit(_chainId, _account);
    },

    getActivePermitHash: (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return permits.getActivePermitHash(_chainId, _account);
    },

    // Mutation methods (auto-fill chainId/account)
    selectActivePermit: (hash: string, chainId?: number, account?: string) => {
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

    // flags (read-only: reflect snapshot)
    get connection() {
      return connectStore.getState();
    },
    get connected() {
      return connectStore.getState().connected;
    },
    get connecting() {
      return connectStore.getState().connecting;
    },

    // config & platform-specific (read-only)
    config: opts.config,

    connect,
    disconnect,
    encryptInputs,
    decryptForView,
    /**
     * @deprecated Use `decryptForView` instead. Kept for backward compatibility.
     */
    decryptHandle: decryptForView,
    decryptForTx,
    permits: clientPermits,

    // Add SDK-specific methods below that require connection
    // Example:
    // async encryptData(data: unknown) {
    //   requireConnected();
    //   // Use state.publicClient and state.walletClient for implementation
    // },
  };
}
