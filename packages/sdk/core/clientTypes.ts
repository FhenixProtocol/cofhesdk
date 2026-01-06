// TODO: Extract client types to its own file, keep this one as primitives
import { type PublicClient, type WalletClient } from 'viem';
import { type CofhesdkConfig } from './config.js';
import { type DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder.js';
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
} from 'permits/types.js';

// CLIENT

export type CofhesdkClient<TConfig extends CofhesdkConfig = CofhesdkConfig> = {
  // --- state access ---
  getSnapshot(): CofhesdkClientConnectionState;
  subscribe(listener: Listener): () => void;

  // --- convenience flags (read-only) ---
  readonly connected: boolean;
  readonly connecting: boolean;

  // --- config & platform-specific ---
  readonly config: TConfig;

  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<boolean>;
  /**
   * Types docstring
   */
  encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilder<[...T]>;
  decryptHandle<U extends FheTypes>(ctHash: bigint, utype: U): DecryptHandlesBuilder<U>;
  permits: CofhesdkClientPermits;
};

export type CofhesdkClientConnectionState = {
  connected: boolean;
  connecting: boolean;
  connectError: unknown | undefined;
  chainId: number | undefined;
  account: `0x${string}` | undefined;
  publicClient: PublicClient | undefined;
  walletClient: WalletClient | undefined;
};

type Listener = (snapshot: CofhesdkClientConnectionState) => void;

export type CofhesdkClientPermits = {
  getSnapshot: typeof permits.getSnapshot;
  subscribe: typeof permits.subscribe;

  // Creation methods (require connection, no params)
  createSelf: (options: CreateSelfPermitOptions) => Promise<Permit>;
  createSharing: (options: CreateSharingPermitOptions) => Promise<Permit>;
  importShared: (options: ImportSharedPermitOptions | any | string) => Promise<Permit>;

  // Retrieval methods (chainId/account optional)
  getPermit: (hash: string, chainId?: number, account?: string) => Promise<Permit | undefined>;
  getPermits: (chainId?: number, account?: string) => Promise<Record<string, Permit>>;
  getActivePermit: (chainId?: number, account?: string) => Promise<Permit | undefined>;
  getActivePermitHash: (chainId?: number, account?: string) => Promise<string | undefined>;

  // Get or create methods (get active or create new, chainId/account optional)
  getOrCreateSelfPermit: (chainId?: number, account?: string, options?: CreateSelfPermitOptions) => Promise<Permit>;
  getOrCreateSharingPermit: (
    options: CreateSharingPermitOptions,
    chainId?: number,
    account?: string
  ) => Promise<Permit>;

  // Mutation methods (chainId/account optional)
  selectActivePermit: (hash: string, chainId?: number, account?: string) => Promise<void>;
  removePermit: (hash: string, chainId?: number, account?: string, force?: boolean) => Promise<void>;
  removeActivePermit: (chainId?: number, account?: string) => Promise<void>;

  // Utils
  getHash: typeof PermitUtils.getHash;
  serialize: typeof PermitUtils.serialize;
  deserialize: typeof PermitUtils.deserialize;
};

export type CofhesdkClientParams<TConfig extends CofhesdkConfig> = {
  config: TConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeyDeserializer: FheKeyDeserializer;
  compactPkeCrsDeserializer: FheKeyDeserializer;
  initTfhe: TfheInitializer;
  zkProveWorkerFn?: ZkProveWorkerFunction;
};
