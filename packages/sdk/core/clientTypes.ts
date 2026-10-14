// TODO: Extract client types to its own file, keep this one as primitives
import { type Hex, type PublicClient, type WalletClient } from 'viem';
import { type CofheConfig } from './config.js';
import { type DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
import { type DecryptForTxBuilderUnset } from './decrypt/decryptForTxBuilder.js';
import { type EncryptInputsBuilderUnset } from './encrypt/encryptInputsBuilder.js';
import { type ZkBuilderAndCrsGenerator, type ZkProveWorkerFunction } from './encrypt/zkPackProveVerify.js';
import { type FheKeyDeserializer } from './fetchKeys.js';
import { acps, type ImportSharedOptions, type ShareOnChainOptions } from './acps.js';
import type { EncryptableItem, FheTypes, TfheInitializer } from './types.js';
import type { ACPUtils } from 'acps/acp.js';
import type {
  ACPAccessStatus,
  CreateSelfACPOptions,
  ACP,
  CreateSharingACPOptions,
  ImportSharedACPOptions,
  SharingACP,
  RecipientACP,
  SelfACP,
  IncomingShare,
  LabelledShare,
} from 'acps/types.js';
import type { ShareLabelCheck, ShareLabelVerifyMode } from 'acps/share-metadata/verify.js';

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

/**
 * Options for `importShared`. `activate: false` stores the imported acp without making it the active
 * one (default `true`). `name` names it (default "Shared by 0x1234…abcd"). Clients default to the
 * connected ones; pass both to override.
 */
export type CofheClientImportSharedOptions = ImportSharedOptions &
  (CofheClientACPsClients | { publicClient?: undefined; walletClient?: undefined });

export type CofheClientACPs = {
  getSnapshot: typeof acps.getSnapshot;
  subscribe: typeof acps.subscribe;

  // Creation methods (require connection, no params)
  createSelf: (options: CreateSelfACPOptions, clients?: CofheClientACPsClients) => Promise<SelfACP>;
  createSharing: (options: CreateSharingACPOptions, clients?: CofheClientACPsClients) => Promise<SharingACP>;
  importShared: (
    options: ImportSharedACPOptions | string,
    importOptions?: CofheClientImportSharedOptions
  ) => Promise<RecipientACP>;

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
  /**
   * The ACP on-chain status as a value instead of a revert. Without a handle: 'valid', or
   * 'expired' / 'revoked' / an invalid signature. With a handle, a valid ACP reports
   * 'allowed', 'out-of-scope' or 'issuer-not-allowed'. For the issuer copy of a share (type
   * 'sharing', no recipient signature yet) the handle-less check covers expiry and revocation only.
   */
  checkAccess: (acp: ACP, handle?: bigint | `0x${string}`) => Promise<ACPAccessStatus>;

  /**
   * Post a signed sharing ACP to the on-chain share registry (ACL-served, or config `acp.sharingRegistry`),
   * optionally with the labels of its handles (`options.labels`, one per handle) or an encoded blob.
   */
  shareOnChain: (acp: ACP, options?: ShareOnChainOptions) => Promise<{ txHash: `0x${string}`; shareId: `0x${string}` }>;
  /** Importable shares addressed to the connected account (unexpired, not revoked), with their metadata. */
  getIncomingShares: () => Promise<IncomingShare[]>;
  /** One share by id, as posted; null when unknown or removed. */
  getShareFromChain: (shareId: `0x${string}`) => Promise<IncomingShare | null>;
  /**
   * Check a share's labels against the chain, index for index with its handles, as far as
   * `verify` says (default 'all'). Takes a share read from the registry or an acp imported from
   * exported JSON (or the issuer's sharing acp). Null for a share without metadata. Throws on a
   * malformed blob.
   */
  verifyShareLabels: (
    share: LabelledShare,
    options?: { verify?: ShareLabelVerifyMode }
  ) => Promise<ShareLabelCheck[] | null>;
  /** Import a share read from the registry: sign as recipient, store and (unless `activate: false`) activate. */
  importFromChain: (share: IncomingShare, options?: ImportSharedOptions) => Promise<RecipientACP>;
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
  /**
   * Runs right before a ZK proof is generated on the calling thread, i.e. only
   * when the worker path is disabled, unavailable or has failed. Platforms use
   * it for setup that only pays off when that thread does the proving (web
   * starts tfhe's rayon thread pool here).
   */
  beforeMainThreadProve?: () => Promise<void>;
};
