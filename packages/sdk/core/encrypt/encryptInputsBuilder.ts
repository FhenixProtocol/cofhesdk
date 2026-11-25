import { type KeysTarget, type VerifyBatchResult, zkVerifyBatch, constructZkPoKMetadata } from './zkPackProveVerify.js';
import {
  mainThreadProvingPath,
  workerProvingPath,
  type MainThreadProving,
  type ProvingParams,
  type ProvingPath,
  type WorkerProving,
} from './provingPaths.js';
import { CofheError, CofheErrorCode } from '../error.js';
import {
  type EncryptStepCallbackFunction,
  EncryptStep,
  type EncryptableItem,
  type EncryptStepCallbackContext,
  type HashPlusProofResult,
} from '../types.js';
import { cofheMocksCheckEncryptableBits, cofheMocksZkVerifySign } from './cofheMocksZkVerifySign.js';
import { hardhat } from 'viem/chains';
import { getCoFheUrlOrThrow, getZkVerifierUrlOrThrow } from '../config.js';
import { type WalletClient, isAddress } from 'viem';
import { sleep } from '../utils.js';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder.js';
import { type KeysStorage } from '../keyStore.js';

type EncryptInputsBuilderParams<T extends EncryptableItem[]> = BaseBuilderParams & {
  inputs: [...T];
  securityZone?: number;

  zkvWalletClient?: WalletClient | undefined;

  proving: ProvingParams;

  /** Where the calling thread keeps the keys. The worker has a store of its own. */
  keysStorage: KeysStorage | undefined;
};

/**
 * EncryptInputsBuilder exposes a builder pattern for encrypting inputs.
 * account, securityZone, and chainId can be overridden in the builder.
 * config, tfhePublicKeyDeserializer, compactPkeCrsDeserializer, and zkBuilderAndCrsGenerator are required to be set in the builder.
 */

/** What every step event of one run of a proving path carries (see `EncryptStepCallbackContext`). */
type ProvingRunContext = Required<Pick<EncryptStepCallbackContext, 'inWorker'>> &
  Pick<EncryptStepCallbackContext, 'workerFailedError'>;

/**
 * The builder as returned by `client.encryptInputs(...)`, before a consuming contract has been set.
 *
 * `execute()` is intentionally absent: the verifier binds the consuming contract into the signed
 * digest, so no batch can be produced until the caller commits to the contract that will consume it.
 * `setConsumingContract(...)` returns the full {@link EncryptInputsBuilder}, unlocking `execute()`.
 */
export type EncryptInputsBuilderUnset<T extends EncryptableItem[]> = Omit<EncryptInputsBuilder<T>, 'execute'>;

export class EncryptInputsBuilder<T extends EncryptableItem[]> extends BaseBuilder {
  private securityZone: number;
  private securityZoneSet: boolean;
  protected consumingContract: string | undefined;
  private stepCallback?: EncryptStepCallbackFunction;
  private inputItems: [...T];

  private zkvWalletClient: WalletClient | undefined;

  private mainThread: MainThreadProving;
  private worker: WorkerProving | undefined;

  private keysStorage: KeysStorage | undefined;

  // Worker configuration (from config, overrideable)
  private useWorker: boolean;

  private stepTimestamps: Record<EncryptStep, number> = {
    [EncryptStep.InitTfhe]: 0,
    [EncryptStep.FetchKeys]: 0,
    [EncryptStep.Pack]: 0,
    [EncryptStep.Prove]: 0,
    [EncryptStep.Verify]: 0,
  };

  constructor(params: EncryptInputsBuilderParams<T>) {
    super({
      config: params.config,
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      chainId: params.chainId,
      account: params.account,
      requireConnected: params.requireConnected,
    });

    this.inputItems = params.inputs;
    this.securityZone = params.securityZone ?? 0;
    this.securityZoneSet = params.securityZone != null;

    this.zkvWalletClient = params.zkvWalletClient;

    const { mainThread, worker } = params.proving;

    // The types require these; the checks are for callers that are not type-checked.
    if (!mainThread.tfhePublicKeyDeserializer) {
      throw new CofheError({
        code: CofheErrorCode.MissingTfhePublicKeyDeserializer,
        message: 'EncryptInputsBuilder tfhePublicKeyDeserializer is undefined',
        hint: 'Ensure client has been created with a tfhePublicKeyDeserializer.',
        context: {
          tfhePublicKeyDeserializer: mainThread.tfhePublicKeyDeserializer,
        },
      });
    }
    if (!mainThread.compactPkeCrsDeserializer) {
      throw new CofheError({
        code: CofheErrorCode.MissingCompactPkeCrsDeserializer,
        message: 'EncryptInputsBuilder compactPkeCrsDeserializer is undefined',
        hint: 'Ensure client has been created with a compactPkeCrsDeserializer.',
        context: {
          compactPkeCrsDeserializer: mainThread.compactPkeCrsDeserializer,
        },
      });
    }
    if (!mainThread.zkBuilderAndCrsGenerator) {
      throw new CofheError({
        code: CofheErrorCode.MissingZkBuilderAndCrsGenerator,
        message: 'EncryptInputsBuilder zkBuilderAndCrsGenerator is undefined',
        hint: 'Ensure client has been created with a zkBuilderAndCrsGenerator.',
        context: {
          zkBuilderAndCrsGenerator: mainThread.zkBuilderAndCrsGenerator,
        },
      });
    }

    this.mainThread = mainThread;
    this.worker = worker;

    // Keys storage is used to store the FHE key and CRS
    this.keysStorage = params.keysStorage;

    // Initialize useWorker from config (can be overridden via setUseWorker) - default to true
    this.useWorker = params.config?.useWorkers ?? true;
  }

  /**
   * @param account - Account that will create the tx using the encrypted inputs.
   *
   * If not provided, the account will be fetched from the connected walletClient.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setAccount("0x123")
   *   .execute();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
  setAccount(this: EncryptInputsBuilder<T>, account: string): EncryptInputsBuilder<T>;
  setAccount(this: EncryptInputsBuilderUnset<T>, account: string): EncryptInputsBuilderUnset<T>;
  setAccount(account: string): EncryptInputsBuilder<T> {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  /**
   * @param chainId - Chain that will consume the encrypted inputs.
   *
   * If not provided, the chainId will be fetched from the connected publicClient.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setChainId(11155111)
   *   .execute();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
  setChainId(this: EncryptInputsBuilder<T>, chainId: number): EncryptInputsBuilder<T>;
  setChainId(this: EncryptInputsBuilderUnset<T>, chainId: number): EncryptInputsBuilderUnset<T>;
  setChainId(chainId: number): EncryptInputsBuilder<T> {
    this.chainId = chainId;
    return this;
  }

  getChainId(): number | undefined {
    return this.chainId;
  }

  /**
   * @param securityZone - Security zone to encrypt the inputs for.
   *
   * If not provided, the security zone of the inputs (`Encryptable.uint8(value, securityZone)`) is
   * used, 0 by default.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setSecurityZone(1)
   *   .execute();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
  setSecurityZone(this: EncryptInputsBuilder<T>, securityZone: number): EncryptInputsBuilder<T>;
  setSecurityZone(this: EncryptInputsBuilderUnset<T>, securityZone: number): EncryptInputsBuilderUnset<T>;
  setSecurityZone(securityZone: number): EncryptInputsBuilder<T> {
    this.securityZone = securityZone;
    this.securityZoneSet = true;
    return this;
  }

  getSecurityZone(): number {
    return this.securityZone;
  }

  /**
   * @param address - The contract that will consume the resulting hashes+signature (i.e. the
   * contract that will call `FHE.asEuint*`/`FHE.asEuint*s` with them).
   *
   * Required before `execute()` - the verifier binds this address into the signed digest, so a
   * batch signed for one contract cannot be replayed into another.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setConsumingContract("0x123...890")
   *   .execute();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
  setConsumingContract(address: string): EncryptInputsBuilder<T> {
    this.consumingContract = address;
    return this;
  }

  getConsumingContract(): string | undefined {
    return this.consumingContract;
  }

  /**
   * Asserts that this.consumingContract is populated and is an address.
   * Runs before TFHE init, key fetching and proving, so a bad address costs
   * nothing: the contract is bound into the proof, and a proof built for a
   * non-address could only fail at the verifier, after the expensive step.
   * @throws {CofheError} If consumingContract is not set or is not an address
   */
  private assertConsumingContract(): asserts this is this & { consumingContract: string } {
    if (!this.consumingContract) {
      throw new CofheError({
        code: CofheErrorCode.ConsumingContractUninitialized,
        message: 'Consuming contract is not set',
        hint: 'Use setConsumingContract(...) to set the contract that will consume the encrypted inputs.',
        context: {
          consumingContract: this.consumingContract,
        },
      });
    }
    // strict: false — 20 bytes of hex in any case, no EIP-55 checksum check. The
    // verifier decodes the address case-insensitively and the chain compares bytes,
    // so a mixed-case address with a wrong checksum works end to end and a patch
    // release must keep accepting it.
    if (!isAddress(this.consumingContract, { strict: false })) {
      throw new CofheError({
        code: CofheErrorCode.ConsumingContractInvalid,
        message: 'Consuming contract is not an address',
        hint: 'setConsumingContract(...) takes the 20-byte address of the contract that will consume the encrypted inputs.',
        context: {
          consumingContract: this.consumingContract,
        },
      });
    }
  }

  /**
   * @param useWorker - Whether to use Web Workers for ZK proof generation.
   *
   * Overrides the config-level useWorkers setting for this specific encryption.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setUseWorker(false)
   *   .execute();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
  setUseWorker(this: EncryptInputsBuilder<T>, useWorker: boolean): EncryptInputsBuilder<T>;
  setUseWorker(this: EncryptInputsBuilderUnset<T>, useWorker: boolean): EncryptInputsBuilderUnset<T>;
  setUseWorker(useWorker: boolean): EncryptInputsBuilder<T> {
    this.useWorker = useWorker;
    return this;
  }

  /**
   * Gets the current worker configuration.
   *
   * @returns Whether Web Workers are enabled for this encryption.
   *
   * Example:
   * ```typescript
   * const builder = encryptInputs([Encryptable.uint128(10n)]);
   * console.log(builder.getUseWorker()); // true (from config)
   * builder.setUseWorker(false);
   * console.log(builder.getUseWorker()); // false (overridden)
   * ```
   */
  getUseWorker(): boolean {
    return this.useWorker;
  }

  /**
   * @param callback - Function to be called with the encryption step.
   *
   * Useful for debugging and tracking the progress of the encryption process.
   * Useful for a UI element that shows the progress of the encryption process.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .onStep((step: EncryptStep) => console.log(step))
   *   .execute();
   * ```
   *
   * @returns The EncryptInputsBuilder instance.
   */
  onStep(this: EncryptInputsBuilder<T>, callback: EncryptStepCallbackFunction): EncryptInputsBuilder<T>;
  onStep(this: EncryptInputsBuilderUnset<T>, callback: EncryptStepCallbackFunction): EncryptInputsBuilderUnset<T>;
  onStep(callback: EncryptStepCallbackFunction): EncryptInputsBuilder<T> {
    this.stepCallback = callback;
    return this;
  }

  getStepCallback(): EncryptStepCallbackFunction | undefined {
    return this.stepCallback;
  }

  /**
   * Fires the step callback if set
   */
  private fireStepStart(
    step: EncryptStep,
    context: Omit<EncryptStepCallbackContext, 'isStart' | 'isEnd' | 'duration'> = {}
  ) {
    if (!this.stepCallback) return;
    this.stepTimestamps[step] = Date.now();
    this.stepCallback(step, { ...context, isStart: true, isEnd: false, duration: 0 });
  }
  private fireStepEnd(
    step: EncryptStep,
    context: Omit<EncryptStepCallbackContext, 'isStart' | 'isEnd' | 'duration'> = {}
  ) {
    if (!this.stepCallback) return;
    const duration = Date.now() - this.stepTimestamps[step];
    this.stepCallback(step, { ...context, isStart: false, isEnd: true, duration });
  }

  /**
   * zkVerifierUrl is included in the chains exported from @cofhe/sdk/chains for use in CofheConfig.supportedChains
   * Users should generally not set this manually.
   */
  private async getZkVerifierUrl(): Promise<string> {
    this.assertChainId();
    return getZkVerifierUrlOrThrow(this.config, this.chainId);
  }

  /**
   * Resolves the encryptDelay config into an array of 5 per-step delays.
   * A single number is broadcast to all steps; a tuple is used as-is.
   */
  private resolveEncryptDelays(): [number, number, number, number, number] {
    const encryptDelay = this.config?.mocks?.encryptDelay ?? [100, 100, 100, 500, 500];
    if (typeof encryptDelay === 'number') {
      return [encryptDelay, encryptDelay, encryptDelay, encryptDelay, encryptDelay];
    }
    return encryptDelay;
  }

  /**
   * @dev Encrypt against the cofheMocks instead of CoFHE
   *
   * In the cofheMocks, the MockZkVerifier contract is deployed on hardhat to a fixed address, this contract handles mocking the zk verifying.
   * cofheMocksInsertPackedHashes - stores the ctHashes and their plaintext values for on-chain mocking of FHE operations.
   * cofheMocksZkCreateProofSignatures - creates signatures to be included in the encrypted inputs. The signers address is known and verified in the mock contracts.
   */
  private async mocksExecute(): Promise<VerifyBatchResult> {
    this.assertAccount();
    this.assertPublicClient();
    this.assertWalletClient();
    this.assertConsumingContract();

    const [initTfheDelay, fetchKeysDelay, packDelay, proveDelay, verifyDelay] = this.resolveEncryptDelays();

    this.fireStepStart(EncryptStep.InitTfhe);
    await sleep(initTfheDelay);
    this.fireStepEnd(EncryptStep.InitTfhe, {
      tfheInitializationExecuted: false,
      isMocks: true,
      mockSleep: initTfheDelay,
    });

    this.fireStepStart(EncryptStep.FetchKeys);
    await sleep(fetchKeysDelay);
    this.fireStepEnd(EncryptStep.FetchKeys, {
      fheKeyFetchedFromCoFHE: false,
      crsFetchedFromCoFHE: false,
      isMocks: true,
      mockSleep: fetchKeysDelay,
    });

    this.fireStepStart(EncryptStep.Pack);
    await cofheMocksCheckEncryptableBits(this.inputItems);
    await sleep(packDelay);
    this.fireStepEnd(EncryptStep.Pack, { isMocks: true, mockSleep: packDelay });

    this.fireStepStart(EncryptStep.Prove);
    await sleep(proveDelay);
    this.fireStepEnd(EncryptStep.Prove, { isMocks: true, mockSleep: proveDelay });

    this.fireStepStart(EncryptStep.Verify);
    await sleep(verifyDelay);
    const result = await cofheMocksZkVerifySign(
      this.inputItems,
      this.account,
      this.securityZone,
      this.consumingContract,
      this.publicClient,
      this.walletClient,
      this.zkvWalletClient
    );
    this.fireStepEnd(EncryptStep.Verify, { isMocks: true, mockSleep: verifyDelay });

    return result;
  }

  /** Which keys this encrypt is made with: what a worker needs to get them by itself. */
  private keysTarget(): KeysTarget {
    this.assertChainId();
    return {
      coFheUrl: getCoFheUrlOrThrow(this.config, this.chainId),
      chainId: this.chainId,
      securityZone: this.getSecurityZone(),
    };
  }

  /**
   * Runs the four proving steps on one path and reports each of them.
   * @param about Goes into every event of the run: which thread the path works on and, for the
   * run that follows a failed worker, why the worker failed.
   * @returns The serialized proven ciphertext list.
   */
  private async proveOn(path: ProvingPath, metadata: Uint8Array, about: ProvingRunContext): Promise<Uint8Array> {
    this.fireStepStart(EncryptStep.InitTfhe, about);

    const tfheInit = await path.initTfhe();

    this.fireStepEnd(EncryptStep.InitTfhe, { ...about, ...tfheInit });

    this.fireStepStart(EncryptStep.FetchKeys, about);

    const keysFetched = await path.fetchKeys();

    this.fireStepEnd(EncryptStep.FetchKeys, { ...about, ...keysFetched });

    this.fireStepStart(EncryptStep.Pack, about);

    path.pack();

    // `packedInWorker` is the older name of `inWorker` on this event.
    this.fireStepEnd(EncryptStep.Pack, { ...about, packedInWorker: about.inWorker });

    this.fireStepStart(EncryptStep.Prove, about);

    const proof = await path.prove(metadata);

    // `usedWorker` is the older name of `inWorker` on this event.
    this.fireStepEnd(EncryptStep.Prove, { ...about, useWorker: this.useWorker, usedWorker: about.inWorker });

    return proof;
  }

  /**
   * In the production context, perform a true encryption with the CoFHE coprocessor.
   */
  private async productionExecute(): Promise<VerifyBatchResult> {
    this.assertAccount();
    this.assertChainId();
    this.assertConsumingContract();

    // The proof is made in a worker when one is to be used, and on this thread otherwise. Each
    // path is whole in itself (see provingPaths.ts); this method only picks one and reports its
    // steps. When the worker path fails, the main-thread path runs from its first step, and
    // those steps are reported as well: a listener sees everything that ran.
    const items = this.inputItems;
    const createMainThreadPath = () =>
      mainThreadProvingPath({
        items,
        // Which keys: read when the path first needs them, so a missing chain fails a step, not the setup.
        keysFor: () => {
          this.assertChainId();
          return { config: this.config, chainId: this.chainId, securityZone: this.getSecurityZone() };
        },
        parts: this.mainThread,
        keysStorage: this.keysStorage,
        readWorkerStoredKeys: this.worker?.readStoredKeys,
      });
    const workerPath =
      this.useWorker && this.worker
        ? workerProvingPath({ items, target: () => this.keysTarget(), worker: this.worker.instance })
        : undefined;

    const metadata = constructZkPoKMetadata(this.account, this.securityZone, this.chainId, this.consumingContract);

    // First choice: the worker.
    let proof: Uint8Array | undefined;
    let workerFailedError: string | undefined;
    if (workerPath) {
      try {
        proof = await this.proveOn(workerPath, metadata, { inWorker: true });
      } catch (error) {
        workerFailedError = error instanceof Error ? error.message : String(error);
      }
    }

    // The main thread: when there is no worker to use, or as the fallback when the worker failed.
    // It starts from its own first step either way.
    if (!proof) {
      proof = await this.proveOn(createMainThreadPath(), metadata, { inWorker: false, workerFailedError });
    }

    this.fireStepStart(EncryptStep.Verify);

    const zkVerifierUrl = await this.getZkVerifierUrl();

    const result = await zkVerifyBatch(
      zkVerifierUrl,
      proof,
      this.account,
      this.securityZone,
      this.chainId,
      this.consumingContract
    );

    this.fireStepEnd(EncryptStep.Verify);

    return result;
  }

  /**
   * One proof covers one security zone. Without `setSecurityZone(...)` the batch takes the zone of its
   * inputs; with it, an input may only name that zone (or leave the default 0). Runs before any key is
   * fetched, since the keys are per zone.
   * @throws {CofheError} If the inputs name different zones, or one other than `setSecurityZone(...)`
   */
  private resolveSecurityZone(): void {
    const itemZones = [...new Set(this.inputItems.map((item) => item.securityZone ?? 0))];
    const conflicting = this.securityZoneSet
      ? itemZones.filter((zone) => zone !== 0 && zone !== this.securityZone)
      : itemZones.length > 1
        ? itemZones
        : [];

    if (conflicting.length > 0) {
      throw new CofheError({
        code: CofheErrorCode.ZkPackFailed,
        message: this.securityZoneSet
          ? `Inputs name security zone ${conflicting.join(', ')}, but setSecurityZone(${this.securityZone}) was called`
          : `Inputs name different security zones (${itemZones.join(', ')}); one encryptInputs call encrypts for one zone`,
        hint: 'Encrypt the inputs of each security zone in their own encryptInputs call.',
        context: {
          securityZone: this.securityZoneSet ? this.securityZone : undefined,
          itemSecurityZones: itemZones,
        },
      });
    }

    if (!this.securityZoneSet) this.securityZone = itemZones[0] ?? 0;
  }

  /**
   * Converts a batch-verified result (per-item ctHash/ctType + one shared signature) into the
   * tuple returned by `execute()`: per-item hashes in input order, followed by the single signature.
   */
  private buildBatchResult(result: VerifyBatchResult): HashPlusProofResult<T> {
    const hashes = result.outputs.map((output) => '0x' + BigInt(output.ct_hash).toString(16).padStart(64, '0'));

    return [...hashes, result.signature] as unknown as HashPlusProofResult<T>;
  }

  /**
   * Final step of the encryption process. MUST BE CALLED LAST IN THE CHAIN.
   *
   * This will:
   * - Pack the encryptable items into a zk proof
   * - Prove the zk proof
   * - Verify the zk proof with CoFHE
   * - Package and return the encrypted inputs
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setAccount('0x123...890') // optional
   *   .setChainId(11155111)      // optional
   *   .execute();                // execute
   * ```
   *
   * @returns The encrypted inputs.
   */
  async execute(): Promise<HashPlusProofResult<T>> {
    this.resolveSecurityZone();

    let result: VerifyBatchResult;

    // On hardhat chain, interact with MockZkVerifier contract instead of CoFHE
    if (this.chainId === hardhat.id) result = await this.mocksExecute();
    // On other chains, interact with CoFHE coprocessor
    else result = await this.productionExecute();

    return this.buildBatchResult(result);
  }
}
