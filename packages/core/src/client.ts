/* eslint-disable no-unused-vars */
import { CofhesdkConfig } from './config';
import { PublicClient, WalletClient } from 'viem';
import { FheKeySerializer } from './fetchKeys';
import { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify';
import { CofhesdkError, CofhesdkErrorCode } from './error';
import { EncryptInputsBuilder } from './encrypt/encryptInputs';

export type ClientSnapshot = {
  connected: boolean;
  connecting: boolean;
  connectError: unknown | null;
  chainId: number | null;
  address: string | null;
};

type Listener = (snapshot: ClientSnapshot) => void;

type InitOptions = {
  config: CofhesdkConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeySerializer: FheKeySerializer;
  compactPkeCrsSerializer: FheKeySerializer;
};

export type CofhesdkClient = {
  // --- state access ---
  getSnapshot(): ClientSnapshot;
  subscribe(listener: Listener): () => void;

  // --- convenience flags (read-only) ---
  readonly connected: boolean;
  readonly connecting: boolean;

  // --- config & platform-specific ---
  readonly config: CofhesdkConfig;

  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<void>;
  encryptInputs<T extends any[]>(inputs: [...T]): Promise<EncryptInputsBuilder<[...T]>>;
};

/**
 * Creates a CoFHE SDK client instance
 * @param {InitOptions} opts - Initialization options including config and platform-specific serializers
 * @returns {CofhesdkClient} - The CoFHE SDK client instance
 */
export function createCofhesdkClient(opts: InitOptions): CofhesdkClient {
  // refs captured in closure
  let _publicClient: PublicClient | null = null;
  let _walletClient: WalletClient | null = null;

  // reactive state
  let state: ClientSnapshot = { connected: false, connecting: false, connectError: null, chainId: null, address: null };
  const listeners = new Set<Listener>();
  const emit = () => {
    for (const l of listeners) l(state);
  };
  const set = (next: Partial<ClientSnapshot>) => {
    state = { ...state, ...next };
    emit();
  };

  // single-flight + abortable warmup
  let _connectPromise: Promise<void> | null = null;

  const _requireConnected = () => {
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

  // LIFECYCLE

  async function connect(publicClient: PublicClient, walletClient: WalletClient) {
    if (state.connected && _publicClient === publicClient && _walletClient === walletClient) return Promise.resolve();
    if (_connectPromise) return _connectPromise;

    set({ connecting: true, connectError: null, connected: false });

    _connectPromise = (async () => {
      try {
        const chainId = await publicClient.getChainId();
        if (chainId === null) {
          throw new CofhesdkError({
            code: CofhesdkErrorCode.NotInitialized,
            message: 'Chain ID is not initialized. Call connect() first.',
          });
        }
        state.chainId = chainId;

        const addresses = await walletClient.getAddresses();
        if (addresses.length === 0) {
          throw new CofhesdkError({
            code: CofhesdkErrorCode.NotInitialized,
            message: 'No addresses found. Call connect() first.',
          });
        }
        state.address = addresses[0];

        _publicClient = publicClient;
        _walletClient = walletClient;
        set({ connected: true });
      } catch (e) {
        set({ connectError: e, connected: false });
        throw e;
      } finally {
        set({ connecting: false });
        _connectPromise = null;
      }
    })();

    return _connectPromise;
  }

  // CLIENT OPERATIONS

  async function encryptInputs<T extends any[]>(inputs: [...T]): Promise<EncryptInputsBuilder<[...T]>> {
    _requireConnected();

    return new EncryptInputsBuilder({
      inputs,
      sender: state.address!,
      chainId: state.chainId!,
      config: opts.config,
      tfhePublicKeySerializer: opts.tfhePublicKeySerializer,
      compactPkeCrsSerializer: opts.compactPkeCrsSerializer,
      zkBuilderAndCrsGenerator: opts.zkBuilderAndCrsGenerator,
    });
  }

  return {
    // reactive accessors
    getSnapshot: () => state,
    subscribe(run) {
      listeners.add(run);
      run(state);
      return () => listeners.delete(run);
    },

    // flags (read-only: reflect snapshot)
    get connected() {
      return state.connected;
    },
    get connecting() {
      return state.connecting;
    },

    // config & platform-specific (read-only)
    get config() {
      return opts.config;
    },

    connect,
    encryptInputs,

    // Add SDK-specific methods below that require connection
    // Example:
    // async encryptData(data: unknown) {
    //   requireConnected();
    //   // Use pub and wal for implementation
    // },
  };
}
