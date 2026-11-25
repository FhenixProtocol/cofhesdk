// TODO: Extract client types to its own file, keep this one as primitives
import { type Hex, type PublicClient, type WalletClient } from 'viem';
import { type CofheConfig } from './config.js';
import { type DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
import { type DecryptForTxBuilderUnset } from './decrypt/decryptForTxBuilder.js';
import { type EncryptInputsBuilderUnset } from './encrypt/encryptInputsBuilder.js';
import { type ZkBuilderAndCrsGenerator, type ZkProveWorkerFunction } from './encrypt/zkPackProveVerify.js';
import { type FheKeyDeserializer } from './fetchKeys.js';
import { acps, type ImportSharedOptions, type ShareOnChainOptions } from './acps.js';
import type {
  DecryptPollCallbackFunction,
  EncryptableItem,
  EncryptStepCallbackFunction,
  FheTypes,
  FheTypeValue,
  FheTypeValueUtypeMap,
  HashPlusProofResult,
  TfheInitializer,
  UnsealedItem,
} from './types.js';
import type { DecryptForTxResult } from './decrypt/decryptForTxBuilder.js';
import type { WalletClientWithAccount } from './utils.js';
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

  /**
   * Connects the client to a chain and an account. The SDK signs and sends as `walletClient.account`,
   * so the wallet client must be created with `account` set; `connect` throws `WALLET_CLIENT_ACCOUNT_MISSING` otherwise.
   */
  connect(publicClient: PublicClient, walletClient: WalletClient): Promise<void>;
  /**
   * Clears the current connection state (account/chainId/clients) and marks the client as disconnected.
   *
   * This does not delete persisted acps or stored FHE keys; it only resets the in-memory connection.
   */
  disconnect(): void;
  /**
   * Encrypts values so a contract can take them as `externalEuint*` / `externalEbool` /
   * `externalEaddress` arguments. Resolves to one hash per input, in input order, followed by the
   * single signature that covers the whole batch.
   *
   * `consumingContract` is the contract that will call `FHE.asEuint*` with the result. The
   * signature is bound to it: the hashes are rejected by any other contract.
   *
   * @example
   * ```ts
   * const [amount, flag, signature] = await client.encryptInputs(
   *   [Encryptable.uint64(100n), Encryptable.bool(true)],
   *   { consumingContract: '0xContract…' }
   * );
   * await walletClient.writeContract({ address, abi, functionName: 'deposit', args: [amount, flag, signature] });
   * ```
   *
   * @throws {CofheError} `NOT_CONNECTED` before `connect`, `INVALID_ARGUMENT` for a value that does
   * not fit its type, `ZK_VERIFY_FAILED` when the verifier rejects the proof. `error.hint` names the fix.
   */
  encryptInputs<T extends EncryptableItem[]>(
    inputs: [...T],
    options: EncryptInputsOptions
  ): Promise<HashPlusProofResult<[...T]>>;
  /**
   * Builder form of `encryptInputs`. `.execute()` is only available after
   * `.setConsumingContract(address)`.
   *
   * @example
   * ```ts
   * const [amount, signature] = await client
   *   .encryptInputs([Encryptable.uint64(100n)])
   *   .setConsumingContract('0xContract…')
   *   .execute();
   * ```
   */
  encryptInputs<T extends EncryptableItem[]>(inputs: [...T]): EncryptInputsBuilderUnset<[...T]>;
  /**
   * @deprecated Use `decryptForView` instead. Kept for backward compatibility.
   */
  decryptHandle<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U>;
  /**
   * Decrypts an encrypted value for display. The plaintext comes back to this client only;
   * nothing is published on chain. Resolves to a `boolean` for `bool`, a checksummed address
   * `string` for `address`, and a `bigint` for the uint types.
   *
   * Needs an ACP that covers the handle. By default the active ACP of the connected account is
   * used; create one with `client.acp.getOrCreateSelfACP()`.
   *
   * @param ctHash - The handle of the encrypted value, as read from the contract (`euint64` etc.).
   * @param utype - The FHE type of the handle: `'uint64'` or `FheTypes.Uint64`. It must match the
   * Solidity type the contract stores.
   * @param options - Pass `{}` for the defaults. Without this argument the call returns a builder.
   *
   * @example
   * ```ts
   * await client.acp.getOrCreateSelfACP();
   * const handle = await publicClient.readContract({ address, abi, functionName: 'balanceOf', args: [account] });
   * const balance = await client.decryptForView(handle, 'uint64', {}); // bigint
   * ```
   *
   * @throws {CofheError} `ACP_NOT_FOUND` without an ACP, `ACP_DENIED` when the ACP does not cover
   * the handle, `CT_NOT_FOUND` for an unknown handle. `error.hint` names the fix.
   */
  decryptForView<V extends FheTypeValue>(
    ctHash: bigint | string,
    utype: V,
    options: DecryptForViewOptions
  ): Promise<UnsealedItem<FheTypeValueUtypeMap<V>>>;
  decryptForView<U extends FheTypes>(
    ctHash: bigint | string,
    utype: U,
    options: DecryptForViewOptions
  ): Promise<UnsealedItem<U>>;
  /**
   * Builder form of `decryptForView`. Call `.execute()` to run it.
   *
   * @example
   * ```ts
   * const balance = await client.decryptForView(handle, FheTypes.Uint64).execute();
   * ```
   */
  decryptForView<V extends FheTypeValue>(
    ctHash: bigint | string,
    utype: V
  ): DecryptForViewBuilder<FheTypeValueUtypeMap<V>>;
  decryptForView<U extends FheTypes>(ctHash: bigint | string, utype: U): DecryptForViewBuilder<U>;
  /**
   * Decrypts an encrypted value together with a Threshold Network signature, so a contract can
   * verify the plaintext when you publish it in a transaction (`FHE.publishDecryptResult`).
   *
   * `options.acp` is required and says who is allowed to decrypt:
   * - `'none'`: the handle is publicly decryptable (`FHE.allowPublic` / global allowance).
   * - `'active'`: use the active ACP of the connected account.
   * - an `ACP`, or the hash of a stored one: use that ACP.
   *
   * @example
   * ```ts
   * const { decryptedValue, signature } = await client.decryptForTx(handle, { acp: 'none' });
   * await walletClient.writeContract({ address, abi, functionName: 'reveal', args: [handle, decryptedValue, signature] });
   * ```
   *
   * @throws {CofheError} `NOT_PUBLICLY_ALLOWED` for `'none'` on a handle that is not public,
   * `ACP_NOT_FOUND` / `ACP_DENIED` for an ACP that is missing or does not cover the handle.
   */
  decryptForTx(ctHash: bigint | string, options: DecryptForTxOptions): Promise<DecryptForTxResult>;
  /**
   * Builder form of `decryptForTx`. `.execute()` is only available after `.withACP(...)` or
   * `.withoutACP()`.
   *
   * @example
   * ```ts
   * const { decryptedValue, signature } = await client.decryptForTx(handle).withoutACP().execute();
   * ```
   */
  decryptForTx(ctHash: bigint | string): DecryptForTxBuilderUnset;
  /**
   * Checks a `decryptForTx` result against the chain, the way a contract would. Resolves to
   * `false` for a signature the `TaskManager` would reject.
   *
   * @param handle - The handle that was decrypted (`DecryptForTxResult.ctHash`).
   * @param cleartext - `DecryptForTxResult.decryptedValue`.
   * @param signature - `DecryptForTxResult.signature`.
   */
  verifyDecryptResult(handle: bigint | string, cleartext: bigint, signature: Hex): Promise<boolean>;
  /** ACP (Access Control Permission) management — create, share, revoke, select. */
  acp: CofheClientACPs;
};

/** Options of `client.encryptInputs(inputs, options)`. Only `consumingContract` is required. */
export type EncryptInputsOptions = {
  /** The contract that will consume the result (the one calling `FHE.asEuint*`). The signature is bound to it. */
  consumingContract: string;
  /** The account that will send the transaction. Default: the connected account. */
  account?: string;
  /** The chain the transaction will be sent on. Default: the connected chain. */
  chainId?: number;
  /** Security zone for the whole batch. Default: the zone of the inputs (0 unless set on the `Encryptable`). */
  securityZone?: number;
  /** Web only: override the config's `useWorkers` for this call. */
  useWorker?: boolean;
  /** Called at the start and end of each step (`initTfhe`, `fetchKeys`, `pack`, `prove`, `verify`). */
  onStep?: EncryptStepCallbackFunction;
};

/** Options shared by `client.decryptForView(..., options)` and `client.decryptForTx(..., options)`. */
type DecryptOptionsBase = {
  /** The chain the handle lives on. Default: the connected chain. */
  chainId?: number;
  /** The account whose ACP is used. Default: the connected account. */
  account?: string;
  /** Called before each retry while the network answers that the result is not ready yet. */
  onPoll?: DecryptPollCallbackFunction;
  /**
   * Milliseconds to keep retrying while the network answers "access denied". Default 0 (no retry).
   * Set it when decrypting right after the transaction that grants access: the network can be a
   * block behind your RPC.
   */
  accessDeniedRetryTimeout?: number;
};

/** An ACP, or the hash of an ACP stored for the account. */
type ACPOrHash = ACP | (string & {});

/** Options of `client.decryptForView(ctHash, utype, options)`. All optional: pass `{}` for the defaults. */
export type DecryptForViewOptions = DecryptOptionsBase & {
  /** The ACP to decrypt with. Default `'active'`: the active ACP of the account. */
  acp?: 'active' | ACPOrHash;
};

/** Options of `client.decryptForTx(ctHash, options)`. `acp` is required. */
export type DecryptForTxOptions = DecryptOptionsBase & {
  /**
   * Who is allowed to decrypt: `'none'` for a publicly decryptable handle, `'active'` for the
   * active ACP of the account, or a specific ACP (or its hash).
   */
  acp: 'none' | 'active' | ACPOrHash;
};

export type CofheClientConnectionState = {
  connected: boolean;
  connecting: boolean;
  connectError: unknown | undefined;
  chainId: number | undefined;
  account: `0x${string}` | undefined;
  publicClient: PublicClient | undefined;
  /** Always has `account` set: `connect` rejects a wallet client without one. */
  walletClient: WalletClientWithAccount | undefined;
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
