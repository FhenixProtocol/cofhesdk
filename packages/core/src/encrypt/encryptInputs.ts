/* eslint-disable no-unused-vars */

import { ZkBuilderAndCrsGenerator, zkPack, zkProve, zkVerify } from './zkPackProveVerify';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { Result, resultWrapper } from '../result';
import { EncryptSetStateFn, EncryptStep, EncryptedItemInput, EncryptedItemInputs } from '../types';
import { encryptExtract, encryptReplace } from './encryptUtils';
import { mockEncrypt } from './mockEncryptInput';
import { sdkStore } from '../sdkStore';
import { hardhat } from 'viem/chains';
import { fetchKeys, FheKeySerializer } from '../fetchKeys';
import { CofhesdkConfig } from '../config';

export function encryptInputs<T extends any[]>(inputs: [...T]): EncryptInputsBuilder<[...T]> {
  const publicClient = sdkStore.getPublicClient();

  // ChainId can be overridden in the builder, so don't throw if doesn't exist yet
  const chainId = publicClient?.chain?.id;

  const walletClient = sdkStore.getWalletClient();

  // Sender can be overridden in the builder, so don't throw if doesn't exist yet
  const sender = walletClient?.account?.address;

  const config = sdkStore.getConfig();
  // Config must already be set in the sdkStore
  if (!config) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingConfig,
      message: 'encryptInputs(): Config not found in sdkStore',
    });
  }

  const tfhePublicKeySerializer = sdkStore.getTfhePublicKeySerializer();
  // TfhePublicKeySerializer must already be set in the sdkStore
  if (!tfhePublicKeySerializer) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingTfhePublicKeySerializer,
      message: 'encryptInputs(): TfhePublicKeySerializer not found in sdkStore',
    });
  }

  const compactPkeCrsSerializer = sdkStore.getCompactPkeCrsSerializer();
  // CompactPkeCrsSerializer must already be set in the sdkStore
  if (!compactPkeCrsSerializer) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingCompactPkeCrsSerializer,
      message: 'encryptInputs(): CompactPkeCrsSerializer not found in sdkStore',
    });
  }

  const zkBuilderAndCrsGenerator = sdkStore.getZkBuilderAndCrsGenerator();
  // ZkBuilderAndCrsGenerator must already be set in the sdkStore
  if (!zkBuilderAndCrsGenerator) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingZkBuilderAndCrsGenerator,
      message: 'encryptInputs(): ZkBuilderAndCrsGenerator not found in sdkStore',
    });
  }

  return new EncryptInputsBuilder<[...T]>({
    inputs,
    sender,
    chainId,
    config,
    tfhePublicKeySerializer,
    compactPkeCrsSerializer,
    zkBuilderAndCrsGenerator,
  });
}

type EncryptInputsBuilderParams<T extends any[]> = {
  inputs: [...T];
  sender?: string;
  chainId?: number;
  securityZone?: number;
  config: CofhesdkConfig;
  tfhePublicKeySerializer: FheKeySerializer;
  compactPkeCrsSerializer: FheKeySerializer;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
};

export class EncryptInputsBuilder<T extends any[]> {
  private sender: string | undefined;
  private chainId: number | undefined;
  private securityZone: number;
  private stepCallback?: EncryptSetStateFn;
  private inputItems: [...T];

  // Config and stuff
  private config: CofhesdkConfig;
  private tfhePublicKeySerializer: FheKeySerializer;
  private compactPkeCrsSerializer: FheKeySerializer;
  private zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;

  constructor(params: EncryptInputsBuilderParams<T>) {
    this.inputItems = params.inputs;
    this.sender = params.sender;
    this.chainId = params.chainId;
    this.securityZone = params.securityZone ?? 0;

    // Config and stuff
    this.config = params.config;
    this.tfhePublicKeySerializer = params.tfhePublicKeySerializer;
    this.compactPkeCrsSerializer = params.compactPkeCrsSerializer;
    this.zkBuilderAndCrsGenerator = params.zkBuilderAndCrsGenerator;
  }

  /**
   * @param sender - The overridden msg.sender of the transaction that will consume the encrypted inputs.
   *
   * If not provided, the account initialized in `cofhejs.initialize` will be used.
   * Used when msg.sender is known to be different from the account initialized in `cofhejs.initialize`,
   * for example when using a paymaster.
   *
   * Example:
   * ```typescript
   * const encrypted = await encryptInputs([Encryptable.uint128(10n)])
   *   .setSender("0x123")
   *   .encrypt();
   * ```
   *
   * @returns The EncryptInputsBuilder instance.
   */
  setSender(sender: string): EncryptInputsBuilder<T> {
    this.sender = sender;
    return this;
  }

  getSender(): string | undefined {
    return this.sender;
  }

  getSenderOrThrow(): string {
    if (this.sender) return this.sender;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SenderUninitialized,
      message:
        'encryptInputs.getSenderOrThrow(): Sender is not initialized, check that the walletClient is initialized, or manually set it with .setSender()',
    });
  }

  setSecurityZone(securityZone: number): EncryptInputsBuilder<T> {
    this.securityZone = securityZone;
    return this;
  }

  getSecurityZone(): number {
    return this.securityZone;
  }

  setChainId(chainId: number): EncryptInputsBuilder<T> {
    this.chainId = chainId;
    return this;
  }

  getChainId(): number | undefined {
    return this.chainId;
  }

  /**
   * @returns The resolved chainId, throws if not undefined
   */
  getChainIdOrThrow(): number {
    if (this.chainId) return this.chainId;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ChainIdUninitialized,
      message:
        'encryptInputs.getChainIdOrThrow(): Chain ID is not initialized, check that the publicClient is initialized, or manually set it with .setChainId()',
    });
  }

  /**
   * @returns The resolved config from the sdkStore.
   */
  getConfigOrThrow(): CofhesdkConfig {
    if (this.config) return this.config;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingConfig,
      message: 'encryptInputs.getConfigOrThrow(): Config fetched from sdkStore is not initialized',
    });
  }

  getTfhePublicKeySerializerOrThrow(): FheKeySerializer {
    if (this.tfhePublicKeySerializer) return this.tfhePublicKeySerializer;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingTfhePublicKeySerializer,
      message: 'encryptInputs.getTfhePublicKeySerializerOrThrow(): TfhePublicKeySerializer not found',
    });
  }

  getCompactPkeCrsSerializerOrThrow(): FheKeySerializer {
    if (this.compactPkeCrsSerializer) return this.compactPkeCrsSerializer;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingCompactPkeCrsSerializer,
      message: 'encryptInputs.getCompactPkeCrsSerializerOrThrow(): CompactPkeCrsSerializer not found',
    });
  }

  /**
   * @returns The resolved zkVerifierUrl for the current chainId.
   */
  getZkVerifierUrlOrThrow(): string {
    const chainId = this.getChainIdOrThrow();
    const config = this.getConfigOrThrow();

    const supportedChain = config.supportedChains.find((chain) => chain.id === chainId);
    if (!supportedChain) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.UnsupportedChain,
        message: `encryptInputs.getZkVerifierUrlOrThrow(): Unsupported chain <${chainId}>`,
      });
    }

    const zkVerifierUrl = supportedChain.verifierUrl;
    if (zkVerifierUrl) return zkVerifierUrl;

    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkVerifierUrlUninitialized,
      message: `encryptInputs.getZkVerifierUrlOrThrow(): ZkVerifierUrl is not initialized for chain <${chainId}>`,
    });
  }

  /**
   * @param callback - A function that will be called with the current step of the encryption process.
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
  setStepCallback(callback: EncryptSetStateFn): EncryptInputsBuilder<T> {
    this.stepCallback = callback;
    return this;
  }

  private fireCallback(step: EncryptStep) {
    if (!this.stepCallback) return;
    this.stepCallback(step);
  }

  private getExtractedEncryptableItems() {
    return encryptExtract(this.inputItems);
  }

  private replaceEncryptableItems(inItems: EncryptedItemInput[]) {
    const [prepared, remaining] = encryptReplace(this.inputItems, inItems);
    if (remaining.length === 0) return prepared;

    throw new CofhesdkError({
      code: CofhesdkErrorCode.EncryptRemainingInItems,
      message: 'encryptInputs.replaceEncryptableItems(): Some encrypted inputs remaining after replacement',
    });
  }

  /**
   * Fetches the FHE key and CRS instances from CoFHE
   * @returns The FHE key and CRS instances.
   */
  private async fetchFheKeyAndCrs(): Promise<{ fheKey: Uint8Array; crs: Uint8Array }> {
    const config = this.getConfigOrThrow();
    const chainId = this.getChainIdOrThrow();
    const compactPkeCrsSerializer = this.getCompactPkeCrsSerializerOrThrow();
    const tfhePublicKeySerializer = this.getTfhePublicKeySerializerOrThrow();
    const securityZone = this.getSecurityZone();

    let fheKey: Uint8Array | undefined;
    let crs: Uint8Array | undefined;

    try {
      [fheKey, crs] = await fetchKeys(config, chainId, securityZone, compactPkeCrsSerializer, tfhePublicKeySerializer);
    } catch (error) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.FetchKeysFailed,
        message: `encryptInputs.fetchFheKeyAndCrs(): Failed to fetch FHE key and CRS`,
      });
    }

    if (!fheKey) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingFheKey,
        message: `encryptInputs.generateZkBuilderAndCrs(): FHE key not found`,
      });
    }

    if (!crs) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingCrs,
        message: `encryptInputs.generateZkBuilderAndCrs(): CRS not found for chainId <${this.chainId}>`,
      });
    }

    return { fheKey, crs };
  }

  /**
   * Generates the ZkCiphertextListBuilder and ZkCompactPkeCrs instances from the FHE key and CRS.
   *
   * @returns The ZkCiphertextListBuilder and ZkCompactPkeCrs instances.
   */
  private generateZkBuilderAndCrs(fheKey: Uint8Array, crs: Uint8Array) {
    const zkBuilderAndCrsGenerator = this.zkBuilderAndCrsGenerator;
    if (!zkBuilderAndCrsGenerator) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingZkBuilderAndCrsGenerator,
        message: `encryptInputs.generateZkBuilderAndCrs(): ZkBuilderAndCrsGenerator not found`,
      });
    }

    return zkBuilderAndCrsGenerator(fheKey, crs);
  }

  /**
   * Final step of the encryption process. MUST BE CALLED LAST IN THE CHAIN.
   *
   * This will:
   * - Extract the encryptable items from the inputs
   * - Pack the encryptable items into a zk proof
   * - Prove the zk proof
   * - Verify the zk proof
   *
   * @returns The encrypted inputs.
   */
  async encrypt(): Promise<Result<[...EncryptedItemInputs<T>]>> {
    return resultWrapper(async () => {
      const sender = this.getSenderOrThrow();
      const chainId = this.getChainIdOrThrow();

      // On hardhat, interact with MockZkVerifier contract instead of CoFHE
      if (chainId === hardhat.id) {
        return await mockEncrypt(this.inputItems, sender, this.securityZone, this.stepCallback);
      }

      this.fireCallback(EncryptStep.FetchKeys);

      const { fheKey, crs } = await this.fetchFheKeyAndCrs();
      let { zkBuilder, zkCrs } = this.generateZkBuilderAndCrs(fheKey, crs);

      this.fireCallback(EncryptStep.Extract);

      const encryptableItems = this.getExtractedEncryptableItems();

      this.fireCallback(EncryptStep.Pack);

      zkBuilder = zkPack(encryptableItems, zkBuilder);

      this.fireCallback(EncryptStep.Prove);

      const proof = await zkProve(zkBuilder, zkCrs, sender, this.securityZone, chainId);

      this.fireCallback(EncryptStep.Verify);

      const zkVerifierUrl = this.getZkVerifierUrlOrThrow();
      const verifyResults = await zkVerify(zkVerifierUrl, proof, sender, this.securityZone, chainId);

      // Add securityZone and utype to the verify results
      const inItems: EncryptedItemInput[] = verifyResults.map(
        ({ ct_hash, signature }: { ct_hash: string; signature: string }, index: number) => ({
          ctHash: BigInt(ct_hash),
          securityZone: this.securityZone,
          utype: encryptableItems[index].utype,
          signature,
        })
      );

      this.fireCallback(EncryptStep.Replace);

      const preparedInputItems = this.replaceEncryptableItems(inItems);

      this.fireCallback(EncryptStep.Done);

      return preparedInputItems;
    });
  }
}
