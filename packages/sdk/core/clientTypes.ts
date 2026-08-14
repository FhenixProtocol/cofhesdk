// TODO: Extract client types to its own file, keep this one as primitives
import { type Hex, type PublicClient, type WalletClient } from 'viem';
import { type CofheConfig } from './config.js';
import { type DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
import { type DecryptForTxBuilderUnset } from './decrypt/decryptForTxBuilder.js';
import { type EncryptInputsBuilderUnset } from './encrypt/encryptInputsBuilder.js';
import { type ZkBuilderAndCrsGenerator, type ZkProveWorkerFunction } from './encrypt/zkPackProveVerify.js';
import { type FheKeyDeserializer } from './fetchKeys.js';
import { acps } from './acps.js';
import type { EncryptableItem, FheTypes, TfheInitializer } from './types.js';
import type { ACPUtils } from 'acps/acp.js';
import type {
  CreateSelfACPOptions,
  ACP,
  CreateSharingACPOptions,
  ImportSharedACPOptions,
  SharingACP,
  RecipientACP,
  SelfACP,
  IncomingShare,
} from 'acps/types.js';

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
   * This does not delete persisted acps or stored FHE keys; it only resets the in-memory connection.
   */
  disconnect(): void;
  /**
   * Types docstring
   */
  encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilderUnset<[...T]>;
  /**
   * @deprecated Use `decryptForView` instead. Kept for backward compatibility.
   */
  decryptHandle<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U>;
  decryptForView<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U>;
  decryptForTx(ctHash: bigint | string): DecryptForTxBuilderUnset;
  verifyDecryptResult(handle: bigint | string, cleartext: bigint, signature: Hex): Promise<boolean>;
  /** ACP (Access Control Permission) management — create, share, revoke, select. */
  acp: CofheClientACPs;
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

export type CofheClientACPsClients = {
  publicClient: PublicClient;
  walletClient: WalletClient;
};

export type CofheClientACPs = {
  getSnapshot: typeof acps.getSnapshot;
  subscribe: typeof acps.subscribe;

  // Creation methods (require connection, no params)
  createSelf: (options: CreateSelfACPOptions, clients?: CofheClientACPsClients) => Promise<SelfACP>;
  createSharing: (options: CreateSharingACPOptions, clients?: CofheClientACPsClients) => Promise<SharingACP>;
  importShared: (options: ImportSharedACPOptions | string, clients?: CofheClientACPsClients) => Promise<RecipientACP>;

  // Retrieval methods (chainId/account optional)
  getACP: (hash: string, chainId?: number, account?: string) => ACP | undefined;
  getACPs: (chainId?: number, account?: string) => Record<string, ACP>;
  getActiveACP: (chainId?: number, account?: string) => ACP | undefined;
  getActiveACPHash: (chainId?: number, account?: string) => string | undefined;

  // Get or create methods (get active or create new, chainId/account optional)
  getOrCreateSelfACP: (chainId?: number, account?: string, options?: CreateSelfACPOptions) => Promise<ACP>;
  getOrCreateSharingACP: (options: CreateSharingACPOptions, chainId?: number, account?: string) => Promise<ACP>;

  // Mutation methods (chainId/account optional)
  selectActiveACP: (hash: string, chainId?: number, account?: string) => void;
  removeACP: (hash: string, chainId?: number, account?: string) => void;
  removeActiveACP: (chainId?: number, account?: string) => void;

  // Revocation (on-chain, require connection)
  revokeACP: (acp: ACP) => Promise<`0x${string}`>;
  revokeAllACPs: (revokerContract?: `0x${string}`) => Promise<`0x${string}`>;
  isACPRevoked: (acp: ACP) => Promise<boolean>;

  /** Post a signed sharing ACP to the on-chain share registry (ACL-served, or config `acp.sharingRegistry`). */
  shareOnChain: (acp: ACP) => Promise<{ txHash: `0x${string}`; shareId: `0x${string}` }>;
  /** Importable shares addressed to the connected account (unexpired, not revoked). */
  getIncomingShares: () => Promise<IncomingShare[]>;
  /** Import a share read from the registry: sign as recipient, store and activate. */
  importFromChain: (share: IncomingShare) => Promise<RecipientACP>;
  /** Recipient-side: remove a share from the registry (after import, or to decline). */
  dismissShare: (shareId: `0x${string}`) => Promise<`0x${string}`>;
  /** Issuer-side: retract a pending share from the registry. */
  cancelShare: (shareId: `0x${string}`) => Promise<`0x${string}`>;

  // Utils
  getHash: typeof ACPUtils.getHash;
  export: typeof ACPUtils.export;
  serialize: typeof ACPUtils.serialize;
  deserialize: typeof ACPUtils.deserialize;
};

export type CofheClientParams<TConfig extends CofheConfig> = {
  config: TConfig;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  tfhePublicKeyDeserializer: FheKeyDeserializer;
  compactPkeCrsDeserializer: FheKeyDeserializer;
  initTfhe: TfheInitializer;
  zkProveWorkerFn?: ZkProveWorkerFunction;
};
