// TODO: Extract client types to its own file, keep this one as primitives
import { type PublicClient, type WalletClient } from 'viem';
import { type CofheConfig } from './config.js';
import { type DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
import { type DecryptForTxBuilderUnset } from './decrypt/decryptForTxBuilder.js';
import { type EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
import { type ZkBuilderAndCrsGenerator, type ZkProveWorkerFunction } from './encrypt/zkPackProveVerify.js';
import { type FheKeyDeserializer } from './fetchKeys.js';
import { permits } from './permits.js';
import type { EncryptableItem, FheTypes, TfheInitializer } from './types.js';
import type { PermitUtils } from 'permits/permit.js';
import type {
  CreateSelfPermitOptions,
  Permit,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
  SharingPermit,
  RecipientPermit,
  SelfPermit,
} from 'permits/types.js';

// CLIENT

export type CofheClient<TConfig extends CofheConfig = CofheConfig> = {
  // --- state access ---
  getSnapshot(): CofheClientConnectionState;
  subscribe(listener: Listener): () => void;

  // --- convenience flags (read-only) ---
  readonly connection: CofheClientConnectionState;
  readonly connected: boolean;
  readonly connecting: boolean;

  // --- config & platform-specific ---
  readonly config: TConfig;

  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<void>;
  /**
   * Clears the current connection state (account/chainId/clients) and marks the client as disconnected.
   *
   * This does not delete persisted permits or stored FHE keys; it only resets the in-memory connection.
   */
  disconnect(): void;
  /**
   * Types docstring
   */
  encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilder<[...T]>;
  /**
   * @deprecated Use `decryptForView` instead. Kept for backward compatibility.
   */
  decryptHandle<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U>;
  decryptForView<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U>;
  decryptForTx(ctHash: bigint | string): DecryptForTxBuilderUnset;
  permits: CofheClientPermits;
};

export type CofheClientConnectionState = {
  connected: boolean;
  connecting: boolean;
  connectError: unknown | undefined;
  chainId: number | undefined;
  account: `0x${string}` | undefined;
  publicClient: PublicClient | undefined;
  walletClient: WalletClient | undefined;
};

type Listener = (snapshot: CofheClientConnectionState) => void;

export type CofheClientPermitsClients = {
  publicClient: PublicClient;
  walletClient: WalletClient;
};

export type CofheClientPermits = {
  getSnapshot: typeof permits.getSnapshot;
  subscribe: typeof permits.subscribe;

  // Creation methods (require connection, no params)
  createSelf: (options: CreateSelfPermitOptions, clients?: CofheClientPermitsClients) => Promise<SelfPermit>;
  createSharing: (options: CreateSharingPermitOptions, clients?: CofheClientPermitsClients) => Promise<SharingPermit>;
  importShared: (
    options: ImportSharedPermitOptions | string,
    clients?: CofheClientPermitsClients
  ) => Promise<RecipientPermit>;

  // Retrieval methods (chainId/account optional)
  getPermit: (hash: string, chainId?: number, account?: string) => Permit | undefined;
  getPermits: (chainId?: number, account?: string) => Record<string, Permit>;
  getActivePermit: (chainId?: number, account?: string) => Permit | undefined;
  getActivePermitHash: (chainId?: number, account?: string) => string | undefined;

  // Get or create methods (get active or create new, chainId/account optional)
  getOrCreateSelfPermit: (chainId?: number, account?: string, options?: CreateSelfPermitOptions) => Promise<Permit>;
  getOrCreateSharingPermit: (
    options: CreateSharingPermitOptions,
    chainId?: number,
    account?: string
  ) => Promise<Permit>;

  // Mutation methods (chainId/account optional)
  selectActivePermit: (hash: string, chainId?: number, account?: string) => void;
  removePermit: (hash: string, chainId?: number, account?: string) => void;
  removeActivePermit: (chainId?: number, account?: string) => void;

  // Utils
  getHash: typeof PermitUtils.getHash;
  serialize: typeof PermitUtils.serialize;
  deserialize: typeof PermitUtils.deserialize;
};

export type CofheClientParams<TConfig extends CofheConfig> = {
  config: TConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeyDeserializer: FheKeyDeserializer;
  compactPkeCrsDeserializer: FheKeyDeserializer;
  initTfhe: TfheInitializer;
  zkProveWorkerFn?: ZkProveWorkerFunction;
};
