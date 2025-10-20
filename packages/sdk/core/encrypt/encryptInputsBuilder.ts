/* eslint-disable no-unused-vars */

import { type ZkBuilderAndCrsGenerator, type ZkProveWorkerData, zkPack, zkProve, zkVerify } from './zkPackProveVerify.js';
import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import { type Result, resultWrapper } from '../result.js';
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

  keysStorage: KeysStorage | undefined;
};

/**
 * EncryptInputsBuilder exposes a builder pattern for encrypting inputs.
 * account, securityZone, and chainId can be overridden in the builder.
 * config, tfhePublicKeyDeserializer, compactPkeCrsDeserializer, and zkBuilderAndCrsGenerator are required to be set in the builder.
 *
 * @dev All errors must be throw in `encrypt`, which wraps them in a Result.
 * Do not throw errors in the constructor or in the builder methods.
 */

export class EncryptInputsBuilder<T extends EncryptableItem[]> extends BaseBuilder {
  private securityZone: number;
  private stepCallback?: EncryptStepCallbackFunction;
  private inputItems: [...T];

  private zkvWalletClient: WalletClient | undefined;

  private tfhePublicKeyDeserializer: FheKeyDeserializer | undefined;
  private compactPkeCrsDeserializer: FheKeyDeserializer | undefined;
  private zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator | undefined;
  private initTfhe: TfheInitializer | undefined;

  private keysStorage: KeysStorage | undefined;

  // Worker-based proof generation data
  private workerData?: ZkProveWorkerData;

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

    this.tfhePublicKeyDeserializer = params.tfhePublicKeyDeserializer;
    this.compactPkeCrsDeserializer = params.compactPkeCrsDeserializer;
    this.zkBuilderAndCrsGenerator = params.zkBuilderAndCrsGenerator;
    this.initTfhe = params.initTfhe;

    this.keysStorage = params.keysStorage;
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
   * tfhePublicKeyDeserializer is a platform-specific dependency injected into core/createCofhesdkClientBase by web/createCofhesdkClient and node/createCofhesdkClient
   * web/ uses zama "tfhe"
   * node/ uses zama "node-tfhe"
   * Users should not set this manually.
   */
  private getTfhePublicKeyDeserializerOrThrow(): FheKeyDeserializer {
    if (this.tfhePublicKeyDeserializer) return this.tfhePublicKeyDeserializer;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingTfhePublicKeyDeserializer,
      message: 'EncryptInputsBuilder tfhePublicKeyDeserializer is undefined',
      hint: 'Ensure client has been created with a tfhePublicKeyDeserializer.',
      context: {
        tfhePublicKeyDeserializer: this.tfhePublicKeyDeserializer,
      },
    });
  }

  /**
   * compactPkeCrsDeserializer is a platform-specific dependency injected into core/createCofhesdkClientBase by web/createCofhesdkClient and node/createCofhesdkClient
   * web/ uses zama "tfhe"
   * node/ uses zama "node-tfhe"
   * Users should not set this manually.
   */
  private getCompactPkeCrsDeserializerOrThrow(): FheKeyDeserializer {
    if (this.compactPkeCrsDeserializer) return this.compactPkeCrsDeserializer;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingCompactPkeCrsDeserializer,
      message: 'EncryptInputsBuilder compactPkeCrsDeserializer is undefined',
      hint: 'Ensure client has been created with a compactPkeCrsDeserializer.',
      context: {
        compactPkeCrsDeserializer: this.compactPkeCrsDeserializer,
      },
    });
  }

  /**
   * zkVerifierUrl is included in the chains exported from cofhesdk/chains for use in CofhesdkConfig.supportedChains
   * Users should generally not set this manually.
   */
  private async getZkVerifierUrl(): Promise<string> {
    const config = this.getConfigOrThrow();
    const chainId = await this.getChainIdOrThrow();
    return getZkVerifierUrlOrThrow(config, chainId);
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
    const config = this.getConfigOrThrow();
    const chainId = await this.getChainIdOrThrow();
    const compactPkeCrsDeserializer = this.getCompactPkeCrsDeserializerOrThrow();
    const tfhePublicKeyDeserializer = this.getTfhePublicKeyDeserializerOrThrow();
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
        config,
        chainId,
        securityZone,
        tfhePublicKeyDeserializer,
        compactPkeCrsDeserializer,
        this.keysStorage
      );
    } catch (error) {
      throw CofhesdkError.fromError(error, {
        code: CofhesdkErrorCode.FetchKeysFailed,
        message: `Failed to fetch FHE key and CRS`,
        context: {
          config,
          chainId,
          securityZone,
          compactPkeCrsDeserializer,
          tfhePublicKeyDeserializer,
        },
      });
    }

    if (!fheKey) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingFheKey,
        message: `FHE key not found`,
        context: {
          chainId,
          securityZone,
        },
      });
    }

    if (!crs) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingCrs,
        message: `CRS not found for chainId <${this.chainId}>`,
        context: {
          chainId,
        },
      });
    }

    return { fheKey, fheKeyFetchedFromCoFHE, crs, crsFetchedFromCoFHE };
  }

  /**
   * zkBuilderAndCrsGenerator is a platform-specific dependency injected into core/createCofhesdkClientBase by web/createCofhesdkClient and node/createCofhesdkClient
   * web/ uses zama "tfhe"
   * node/ uses zama "node-tfhe"
   * Users should not set this manually.
   *
   * Generates the zkBuilder and zkCrs from the fheKey and crs
   */
  private generateZkBuilderAndCrs(fheKey: string, crs: string) {
    const zkBuilderAndCrsGenerator = this.zkBuilderAndCrsGenerator;

    if (!zkBuilderAndCrsGenerator) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingZkBuilderAndCrsGenerator,
        message: `zkBuilderAndCrsGenerator is undefined`,
        hint: 'Ensure client has been created with a zkBuilderAndCrsGenerator.',
        context: {
          zkBuilderAndCrsGenerator: this.zkBuilderAndCrsGenerator,
        },
      });
    }

    return zkBuilderAndCrsGenerator(fheKey, crs);
  }

  /**
   * @dev Encrypt against the cofheMocks instead of CoFHE
   *
   * In the cofheMocks, the MockZkVerifier contract is deployed on hardhat to a fixed address, this contract handles mocking the zk verifying.
   * cofheMocksInsertPackedHashes - stores the ctHashes and their plaintext values for on-chain mocking of FHE operations.
   * cofheMocksZkCreateProofSignatures - creates signatures to be included in the encrypted inputs. The signers address is known and verified in the mock contracts.
   */
  private async mocksEncrypt(account: string): Promise<[...EncryptedItemInputs<T>]> {
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
      account,
      this.securityZone,
      this.getPublicClientOrThrow(),
      this.getWalletClientOrThrow(),
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
  private async productionEncrypt(account: string, chainId: number): Promise<[...EncryptedItemInputs<T>]> {
    this.fireStepStart(EncryptStep.InitTfhe);

    // Deferred initialization of tfhe wasm until encrypt is called
    // Returns true if tfhe was initialized, false if already initialized
    const tfheInitializationExecuted = await this.initTfheOrThrow();

    this.fireStepEnd(EncryptStep.InitTfhe, { tfheInitializationExecuted });

    this.fireStepStart(EncryptStep.FetchKeys);
    
    // Deferred fetching of fheKey and crs until encrypt is called
    // if the key/crs is already in the store, it is not fetched from the CoFHE API
    const { fheKey, fheKeyFetchedFromCoFHE, crs, crsFetchedFromCoFHE } = await this.fetchFheKeyAndCrs();
    
    // Prepare worker data for proof generation
    this.workerData = {
      fheKeyHex: fheKey,
      crsHex: crs,
      items: this.inputItems,
      useWorker: true,
    };
    
    let { zkBuilder, zkCrs } = this.generateZkBuilderAndCrs(fheKey, crs);

    this.fireStepEnd(EncryptStep.FetchKeys, { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE });

    this.fireStepStart(EncryptStep.Pack);

    zkBuilder = zkPack(this.inputItems, zkBuilder);

    this.fireStepEnd(EncryptStep.Pack);

    this.fireStepStart(EncryptStep.Prove);
    const proof = await zkProve(zkBuilder, zkCrs, account, this.securityZone, chainId, this.workerData);
    this.fireStepEnd(EncryptStep.Prove);

    this.fireStepStart(EncryptStep.Verify);

    const zkVerifierUrl = await this.getZkVerifierUrl();
    
    const verifyResults = await zkVerify(zkVerifierUrl, proof, account, this.securityZone, chainId);
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
  async encrypt(): Promise<Result<[...EncryptedItemInputs<T>]>> {
    return resultWrapper(async () => {
      // Ensure cofhe client is connected
      await this.requireConnectedOrThrow();

      const account = await this.getAccountOrThrow();
      const chainId = await this.getChainIdOrThrow();

      // On hardhat, interact with MockZkVerifier contract instead of CoFHE
      if (chainId === hardhat.id) {
        return await this.mocksEncrypt(account);
      }

      return await this.productionEncrypt(account, chainId);
    });
  }
}
