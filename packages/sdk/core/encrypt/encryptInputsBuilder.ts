import {
  type ZkBuilderAndCrsGenerator,
  type ZkProveWorkerFunction,
  zkPack,
  zkProve,
  zkProveWithWorker,
  zkVerify,
  constructZkPoKMetadata,
} from './zkPackProveVerify.js';
import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import {
  type EncryptStepCallbackFunction,
  EncryptStep,
  type EncryptableItem,
  type EncryptedItemInput,
  type EncryptedItemInputs,
  type TfheInitializer,
  type EncryptStepCallbackContext,
} from '../types.js';
import { cofheMocksCheckEncryptableBits, cofheMocksZkVerifySign } from './cofheMocksZkVerifySign.js';
import { hardhat } from 'viem/chains';
import { fetchKeys, type FheKeyDeserializer } from '../fetchKeys.js';
import { getZkVerifierUrlOrThrow } from '../config.js';
import { type WalletClient } from 'viem';
import { sleep } from '../utils.js';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder.js';
import { type KeysStorage } from '../keyStore.js';

type EncryptInputsBuilderParams<T extends EncryptableItem[]> = BaseBuilderParams & {
  inputs: [...T];
  securityZone?: number;

  zkvWalletClient?: WalletClient | undefined;

  tfhePublicKeyDeserializer: FheKeyDeserializer | undefined;
  compactPkeCrsDeserializer: FheKeyDeserializer | undefined;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator | undefined;
  initTfhe: TfheInitializer | undefined;
  zkProveWorkerFn: ZkProveWorkerFunction | undefined;

  keysStorage: KeysStorage | undefined;
};

/**
 * EncryptInputsBuilder exposes a builder pattern for encrypting inputs.
 * account, securityZone, and chainId can be overridden in the builder.
 * config, tfhePublicKeyDeserializer, compactPkeCrsDeserializer, and zkBuilderAndCrsGenerator are required to be set in the builder.
 */

export class EncryptInputsBuilder<T extends EncryptableItem[]> extends BaseBuilder {
  private securityZone: number;
  private stepCallback?: EncryptStepCallbackFunction;
  private inputItems: [...T];

  private zkvWalletClient: WalletClient | undefined;

  private tfhePublicKeyDeserializer: FheKeyDeserializer;
  private compactPkeCrsDeserializer: FheKeyDeserializer;
  private zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  private initTfhe: TfheInitializer | undefined;
  private zkProveWorkerFn: ZkProveWorkerFunction | undefined;

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

    this.zkvWalletClient = params.zkvWalletClient;

    // Check that tfhePublicKeyDeserializer is provided
    if (!params.tfhePublicKeyDeserializer) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingTfhePublicKeyDeserializer,
        message: 'EncryptInputsBuilder tfhePublicKeyDeserializer is undefined',
        hint: 'Ensure client has been created with a tfhePublicKeyDeserializer.',
        context: {
          tfhePublicKeyDeserializer: params.tfhePublicKeyDeserializer,
        },
      });
    }
    this.tfhePublicKeyDeserializer = params.tfhePublicKeyDeserializer;

    // Check that compactPkeCrsDeserializer is provided
    if (!params.compactPkeCrsDeserializer) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingCompactPkeCrsDeserializer,
        message: 'EncryptInputsBuilder compactPkeCrsDeserializer is undefined',
        hint: 'Ensure client has been created with a compactPkeCrsDeserializer.',
        context: {
          compactPkeCrsDeserializer: params.compactPkeCrsDeserializer,
        },
      });
    }
    this.compactPkeCrsDeserializer = params.compactPkeCrsDeserializer;

    // Check that zkBuilderAndCrsGenerator is provided
    if (!params.zkBuilderAndCrsGenerator) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingZkBuilderAndCrsGenerator,
        message: 'EncryptInputsBuilder zkBuilderAndCrsGenerator is undefined',
        hint: 'Ensure client has been created with a zkBuilderAndCrsGenerator.',
        context: {
          zkBuilderAndCrsGenerator: params.zkBuilderAndCrsGenerator,
        },
      });
    }
    this.zkBuilderAndCrsGenerator = params.zkBuilderAndCrsGenerator;

    // Optional tfhe initialization function, will be run if provided
    this.initTfhe = params.initTfhe;

    // Optional zkProve worker function, will be used on web if useWorkers is true and worker function is provided
    this.zkProveWorkerFn = params.zkProveWorkerFn;

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
   *   .encrypt();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
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
   *   .encrypt();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
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
   * If not provided, the default securityZone 0 will be used.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setSecurityZone(1)
   *   .encrypt();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
  setSecurityZone(securityZone: number): EncryptInputsBuilder<T> {
    this.securityZone = securityZone;
    return this;
  }

  getSecurityZone(): number {
    return this.securityZone;
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
   *   .encrypt();
   * ```
   *
   * @returns The chainable EncryptInputsBuilder instance.
   */
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
   *   .setStepCallback((step: EncryptStep) => console.log(step))
   *   .encrypt();
   * ```
   *
   * @returns The EncryptInputsBuilder instance.
   */
  setStepCallback(callback: EncryptStepCallbackFunction): EncryptInputsBuilder<T> {
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
   * zkVerifierUrl is included in the chains exported from cofhesdk/chains for use in CofhesdkConfig.supportedChains
   * Users should generally not set this manually.
   */
  private async getZkVerifierUrl(): Promise<string> {
    this.assertChainId();
    return getZkVerifierUrlOrThrow(this.config, this.chainId);
  }

  /**
   * initTfhe is a platform-specific dependency injected into core/createCofhesdkClientBase by web/createCofhesdkClient and node/createCofhesdkClient
   * web/ uses zama "tfhe"
   * node/ uses zama "node-tfhe"
   * Users should not set this manually.
   */
  private async initTfheOrThrow(): Promise<boolean> {
    if (!this.initTfhe) return false;

    try {
      return await this.initTfhe();
    } catch (error) {
      throw CofhesdkError.fromError(error, {
        code: CofhesdkErrorCode.InitTfheFailed,
        message: `Failed to initialize TFHE`,
        context: {
          initTfhe: this.initTfhe,
        },
      });
    }
  }

  /**
   * Fetches the FHE key and CRS from the CoFHE API
   * If the key/crs already exists in the store it is returned, else it is fetched, stored, and returned
   */
  private async fetchFheKeyAndCrs(): Promise<{
    fheKey: string;
    fheKeyFetchedFromCoFHE: boolean;
    crs: string;
    crsFetchedFromCoFHE: boolean;
  }> {
    this.assertChainId();
    const securityZone = this.getSecurityZone();

    try {
      await this.keysStorage?.rehydrateKeysStore();
    } catch (error) {
      throw CofhesdkError.fromError(error, {
        code: CofhesdkErrorCode.RehydrateKeysStoreFailed,
        message: `Failed to rehydrate keys store`,
        context: {
          keysStorage: this.keysStorage,
        },
      });
    }

    let fheKey: string | undefined;
    let fheKeyFetchedFromCoFHE: boolean = false;
    let crs: string | undefined;
    let crsFetchedFromCoFHE: boolean = false;

    try {
      [[fheKey, fheKeyFetchedFromCoFHE], [crs, crsFetchedFromCoFHE]] = await fetchKeys(
        this.config,
        this.chainId,
        securityZone,
        this.tfhePublicKeyDeserializer,
        this.compactPkeCrsDeserializer,
        this.keysStorage
      );
    } catch (error) {
      throw CofhesdkError.fromError(error, {
        code: CofhesdkErrorCode.FetchKeysFailed,
        message: `Failed to fetch FHE key and CRS`,
        context: {
          config: this.config,
          chainId: this.chainId,
          securityZone,
          compactPkeCrsDeserializer: this.compactPkeCrsDeserializer,
          tfhePublicKeyDeserializer: this.tfhePublicKeyDeserializer,
        },
      });
    }

    if (!fheKey) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingFheKey,
        message: `FHE key not found`,
        context: {
          chainId: this.chainId,
          securityZone,
        },
      });
    }

    if (!crs) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingCrs,
        message: `CRS not found for chainId <${this.chainId}>`,
        context: {
          chainId: this.chainId,
        },
      });
    }

    return { fheKey, fheKeyFetchedFromCoFHE, crs, crsFetchedFromCoFHE };
  }

  /**
   * @dev Encrypt against the cofheMocks instead of CoFHE
   *
   * In the cofheMocks, the MockZkVerifier contract is deployed on hardhat to a fixed address, this contract handles mocking the zk verifying.
   * cofheMocksInsertPackedHashes - stores the ctHashes and their plaintext values for on-chain mocking of FHE operations.
   * cofheMocksZkCreateProofSignatures - creates signatures to be included in the encrypted inputs. The signers address is known and verified in the mock contracts.
   */
  private async mocksEncrypt(): Promise<[...EncryptedItemInputs<T>]> {
    this.assertAccount();
    this.assertPublicClient();
    this.assertWalletClient();

    this.fireStepStart(EncryptStep.InitTfhe);
    await sleep(100);
    this.fireStepEnd(EncryptStep.InitTfhe, { tfheInitializationExecuted: false });

    this.fireStepStart(EncryptStep.FetchKeys);
    await sleep(100);
    this.fireStepEnd(EncryptStep.FetchKeys, { fheKeyFetchedFromCoFHE: false, crsFetchedFromCoFHE: false });

    this.fireStepStart(EncryptStep.Pack);
    await cofheMocksCheckEncryptableBits(this.inputItems);
    await sleep(100);
    this.fireStepEnd(EncryptStep.Pack);

    this.fireStepStart(EncryptStep.Prove);
    await sleep(500);
    this.fireStepEnd(EncryptStep.Prove);

    this.fireStepStart(EncryptStep.Verify);
    await sleep(500);
    const signedResults = await cofheMocksZkVerifySign(
      this.inputItems,
      this.account,
      this.securityZone,
      this.publicClient,
      this.walletClient,
      this.zkvWalletClient
    );
    const encryptedInputs: EncryptedItemInput[] = signedResults.map(({ ct_hash, signature }, index) => ({
      ctHash: BigInt(ct_hash),
      securityZone: this.securityZone,
      utype: this.inputItems[index].utype,
      signature,
    }));
    this.fireStepEnd(EncryptStep.Verify);

    return encryptedInputs as [...EncryptedItemInputs<T>];
  }

  /**
   * In the production context, perform a true encryption with the CoFHE coprocessor.
   */
  private async productionEncrypt(): Promise<[...EncryptedItemInputs<T>]> {
    this.assertAccount();
    this.assertChainId();

    this.fireStepStart(EncryptStep.InitTfhe);

    // Deferred initialization of tfhe wasm until encrypt is called
    // Returns true if tfhe was initialized, false if already initialized
    const tfheInitializationExecuted = await this.initTfheOrThrow();

    this.fireStepEnd(EncryptStep.InitTfhe, { tfheInitializationExecuted });

    this.fireStepStart(EncryptStep.FetchKeys);

    // Deferred fetching of fheKey and crs until encrypt is called
    // if the key/crs is already in the store, it is not fetched from the CoFHE API
    const { fheKey, fheKeyFetchedFromCoFHE, crs, crsFetchedFromCoFHE } = await this.fetchFheKeyAndCrs();

    let { zkBuilder, zkCrs } = this.zkBuilderAndCrsGenerator(fheKey, crs);

    this.fireStepEnd(EncryptStep.FetchKeys, { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE });

    this.fireStepStart(EncryptStep.Pack);

    zkBuilder = zkPack(this.inputItems, zkBuilder);

    this.fireStepEnd(EncryptStep.Pack);

    this.fireStepStart(EncryptStep.Prove);

    // Construct metadata once (used by both worker and main thread paths)
    const metadata = constructZkPoKMetadata(this.account, this.securityZone, this.chainId);

    let proof: Uint8Array | null = null;
    let usedWorker = false;
    let workerFailedError: string | undefined;

    // Decision logic: try worker if enabled and available, fallback to main thread
    if (this.useWorker && this.zkProveWorkerFn) {
      try {
        // Call worker function directly (no packing needed, worker does it)
        proof = await zkProveWithWorker(this.zkProveWorkerFn, fheKey, crs, this.inputItems, metadata);
        usedWorker = true;
      } catch (error) {
        // Worker failed - capture error for debugging
        workerFailedError = error instanceof Error ? error.message : String(error);
      }
    }

    if (proof == null) {
      // Use main thread directly (workers disabled or unavailable)
      proof = await zkProve(zkBuilder, zkCrs, metadata);
      usedWorker = false;
    }

    this.fireStepEnd(EncryptStep.Prove, {
      useWorker: this.useWorker,
      usedWorker,
      workerFailedError,
    });

    this.fireStepStart(EncryptStep.Verify);

    const zkVerifierUrl = await this.getZkVerifierUrl();

    const verifyResults = await zkVerify(zkVerifierUrl, proof, this.account, this.securityZone, this.chainId);
    // Add securityZone and utype to the verify results
    const encryptedInputs: EncryptedItemInput[] = verifyResults.map(
      ({ ct_hash, signature }: { ct_hash: string; signature: string }, index: number) => ({
        ctHash: BigInt(ct_hash),
        securityZone: this.securityZone,
        utype: this.inputItems[index].utype,
        signature,
      })
    );

    this.fireStepEnd(EncryptStep.Verify);

    return encryptedInputs as [...EncryptedItemInputs<T>];
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
   *   .encrypt();                // execute
   * ```
   *
   * @returns The encrypted inputs.
   */
  async encrypt(): Promise<[...EncryptedItemInputs<T>]> {
    // On hardhat chain, interact with MockZkVerifier contract instead of CoFHE
    if (this.chainId === hardhat.id) return this.mocksEncrypt();

    // On other chains, interact with CoFHE coprocessor
    return this.productionEncrypt();
  }
}
