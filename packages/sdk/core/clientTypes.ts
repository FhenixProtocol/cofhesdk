// TODO: Extract client types to its own file, keep this one as primitives
import { type PublicClient, type WalletClient } from 'viem';
import { type CofhesdkConfig } from './config.js';
import { type DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder.js';
import { type EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
import { type ZkBuilderAndCrsGenerator, type ZkProveWorkerFunction } from './encrypt/zkPackProveVerify.js';
import { type FheKeyDeserializer } from './fetchKeys.js';
import { permits } from './permits.js';
import { type Result } from './result.js';
import type { EncryptableItem, FheTypes, TfheInitializer } from './types.js';
import type { PermitUtils } from 'permits/permit.js';
import type {
  CreateSelfPermitOptions,
  Permit,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
} from 'permits/types.js';

// CLIENT

export type CofhesdkClient = {
  // --- state access ---
  getSnapshot(): CofhesdkClientConnectionState;
  subscribe(listener: Listener): () => void;

  // --- convenience flags (read-only) ---
  readonly connected: boolean;
  readonly connecting: boolean;

  // --- config & platform-specific ---
  readonly config: CofhesdkConfig;

  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<Result<boolean>>;
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
  account: string | undefined;
  publicClient: PublicClient | undefined;
  walletClient: WalletClient | undefined;
};

type Listener = (snapshot: CofhesdkClientConnectionState) => void;

export type CofhesdkClientPermits = {
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

  // Get or create methods (get active or create new, chainId/account optional)
  getOrCreateSelfPermit: (
    chainId?: number,
    account?: string,
    options?: CreateSelfPermitOptions
  ) => Promise<Result<Permit>>;
  getOrCreateSharingPermit: (
    options: CreateSharingPermitOptions,
    chainId?: number,
    account?: string
  ) => Promise<Result<Permit>>;

  // Mutation methods (chainId/account optional)
  selectActivePermit: (hash: string, chainId?: number, account?: string) => Promise<Result<void>>;
  removePermit: (hash: string, chainId?: number, account?: string, force?: boolean) => Promise<Result<void>>;
  removeActivePermit: (chainId?: number, account?: string) => Promise<Result<void>>;

  // Utils
  getHash: typeof PermitUtils.getHash;
  serialize: typeof PermitUtils.serialize;
  deserialize: typeof PermitUtils.deserialize;
};

export type CofhesdkClientParams = {
  config: CofhesdkConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeyDeserializer: FheKeyDeserializer;
  compactPkeCrsDeserializer: FheKeyDeserializer;
  initTfhe: TfheInitializer;
  zkProveWorkerFn?: ZkProveWorkerFunction;
};
