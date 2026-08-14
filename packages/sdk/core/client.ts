import type { CreateSelfACPOptions, CreateSharingACPOptions, ImportSharedACPOptions } from '@/acps';

import { createStore } from 'zustand/vanilla';
import { type Hex, type PublicClient, type WalletClient } from 'viem';
import { CofheError, CofheErrorCode } from './error.js';
import { EncryptInputsBuilder, type EncryptInputsBuilderUnset } from './encrypt/encryptInputsBuilder.js';
import { createKeysStore } from './keyStore.js';
import { acps } from './acps.js';
import { DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
import { DecryptForTxBuilder, type DecryptForTxBuilderUnset } from './decrypt/decryptForTxBuilder.js';
import { verifyDecryptResult as verifyDecryptResultStandalone } from './decrypt/verifyDecryptResult.js';
import { getPublicClientChainID, getWalletClientAccount } from './utils.js';
import type { CofheClientConnectionState, CofheClientParams, CofheClient, CofheClientACPs } from './clientTypes.js';
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

  // Share registry resolution: explicit `acp.sharingRegistry` config wins,
  // otherwise the address the chain's ACL serves.
  const _resolveSharingRegistry = async (publicClient: PublicClient, chainId: number): Promise<`0x${string}`> => {
    const configured = opts.config.acp?.sharingRegistry?.[chainId];
    if (configured != null) return configured;
    const registry = (await acps.getAclServedAddresses(publicClient, chainId)).shareRegistry;
    if (registry == null) {
      throw new CofheError({
        code: CofheErrorCode.MissingConfig,
        message: `No ACP share registry available for chainId <${chainId}>`,
        hint: 'The ACL on this chain does not serve a share registry address. Set `acp.sharingRegistry` in the cofhe config to use on-chain sharing.',
        context: { chainId },
      });
    }
    return registry;
  };

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

  function encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilderUnset<[...T]> {
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

  // VERIFY DECRYPT RESULT
  function verifyDecryptResult(handle: bigint | string, cleartext: bigint, signature: Hex): Promise<boolean> {
    _requireConnected();
    const { publicClient } = connectStore.getState();
    return verifyDecryptResultStandalone(handle, cleartext, signature, publicClient!);
  }

  // ACPS - Context-aware wrapper

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

  const clientACPs: CofheClientACPs = {
    // Pass through store access
    getSnapshot: acps.getSnapshot,
    subscribe: acps.subscribe,

    // Creation methods (require connection)
    createSelf: async (
      options: CreateSelfACPOptions,
      clients?: { publicClient: PublicClient; walletClient: WalletClient }
    ) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      const chainId = await publicClient!.getChainId();
      return acps.createSelf(
        await acps.applyACPDefaultsFromChain(options, opts.config.acp, publicClient!, chainId),
        publicClient!,
        walletClient!
      );
    },

    createSharing: async (
      options: CreateSharingACPOptions,
      clients?: { publicClient: PublicClient; walletClient: WalletClient }
    ) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      const chainId = await publicClient!.getChainId();
      return acps.createSharing(
        await acps.applyACPDefaultsFromChain(options, opts.config.acp, publicClient!, chainId),
        publicClient!,
        walletClient!
      );
    },

    importShared: async (
      options: ImportSharedACPOptions | string,
      clients?: { publicClient: PublicClient; walletClient: WalletClient }
    ) => {
      _requireConnected();
      const { publicClient, walletClient } = clients ?? connectStore.getState();
      return acps.importShared(options, publicClient!, walletClient!);
    },

    // Get or create methods (require connection)
    getOrCreateSelfACP: async (chainId?: number, account?: string, options?: CreateSelfACPOptions) => {
      _requireConnected();
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      const { publicClient, walletClient } = connectStore.getState();
      const optionsWithDefaults = await acps.applyACPDefaultsFromChain(
        options ?? { issuer: _account, name: 'Autogenerated Self ACP' },
        opts.config.acp,
        publicClient!,
        _chainId
      );
      return acps.getOrCreateSelfACP(publicClient!, walletClient!, _chainId, _account, optionsWithDefaults);
    },

    getOrCreateSharingACP: async (options: CreateSharingACPOptions, chainId?: number, account?: string) => {
      _requireConnected();
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      const { publicClient, walletClient } = connectStore.getState();
      return acps.getOrCreateSharingACP(
        publicClient!,
        walletClient!,
        await acps.applyACPDefaultsFromChain(options, opts.config.acp, publicClient!, _chainId),
        _chainId,
        _account
      );
    },

    // Revocation (require connection)
    revokeACP: async (acp) => {
      _requireConnected();
      const { walletClient } = connectStore.getState();
      return acps.revokeACP(acp, walletClient!);
    },

    revokeAllACPs: async (revokerContract?: `0x${string}`) => {
      _requireConnected();
      const { publicClient, walletClient } = connectStore.getState();
      return acps.revokeAllACPs(walletClient!, publicClient!, revokerContract);
    },

    isACPRevoked: async (acp) => {
      _requireConnected();
      const { publicClient } = connectStore.getState();
      return acps.isACPRevoked(acp, publicClient!);
    },

    // On-chain sharing (require connection + config.acp.sharingRegistry)
    shareOnChain: async (acp) => {
      _requireConnected();
      const { publicClient, walletClient } = connectStore.getState();
      const chainId = await publicClient!.getChainId();
      const sharingRegistry = await _resolveSharingRegistry(publicClient!, chainId);
      return acps.shareOnChain(acp, walletClient!, sharingRegistry);
    },

    getIncomingShares: async () => {
      _requireConnected();
      const { publicClient, walletClient } = connectStore.getState();
      const chainId = await publicClient!.getChainId();
      const account = walletClient!.account!.address;
      const sharingRegistry = await _resolveSharingRegistry(publicClient!, chainId);
      return acps.getIncomingShares(publicClient!, sharingRegistry, account);
    },

    importFromChain: async (share) => {
      _requireConnected();
      const { publicClient, walletClient } = connectStore.getState();
      return acps.importFromChain(share, publicClient!, walletClient!);
    },

    dismissShare: async (shareId) => {
      _requireConnected();
      const { publicClient, walletClient } = connectStore.getState();
      const chainId = await publicClient!.getChainId();
      const sharingRegistry = await _resolveSharingRegistry(publicClient!, chainId);
      return acps.removeShareOnChain(shareId, walletClient!, sharingRegistry);
    },

    cancelShare: async (shareId) => {
      _requireConnected();
      const { publicClient, walletClient } = connectStore.getState();
      const chainId = await publicClient!.getChainId();
      const sharingRegistry = await _resolveSharingRegistry(publicClient!, chainId);
      return acps.removeShareOnChain(shareId, walletClient!, sharingRegistry);
    },

    // Retrieval methods (auto-fill chainId/account)
    getACP: (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.getACP(_chainId, _account, hash);
    },

    getACPs: (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.getACPs(_chainId, _account);
    },

    getActiveACP: (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.getActiveACP(_chainId, _account);
    },

    getActiveACPHash: (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.getActiveACPHash(_chainId, _account);
    },

    // Mutation methods (auto-fill chainId/account)
    selectActiveACP: (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.selectActiveACP(_chainId, _account, hash);
    },

    removeACP: async (hash: string, chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.removeACP(_chainId, _account, hash);
    },

    removeActiveACP: async (chainId?: number, account?: string) => {
      const { chainId: _chainId, account: _account } = _getChainIdAndAccount(chainId, account);
      return acps.removeActiveACP(_chainId, _account);
    },

    // Utils (no context needed)
    getHash: acps.getHash,
    export: acps.export,
    serialize: acps.serialize,
    deserialize: acps.deserialize,
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
    verifyDecryptResult,
    acp: clientACPs,

    // Add SDK-specific methods below that require connection
    // Example:
    // async encryptData(data: unknown) {
    //   requireConnected();
    //   // Use state.publicClient and state.walletClient for implementation
    // },
  };
}
