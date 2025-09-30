/* eslint-disable no-unused-vars */

import { VerifyResult, ZkCiphertextListBuilder, ZkCompactPkeCrs, zkPack, zkProve, zkVerify } from './zkPackProveVerify';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { Result, resultWrapper } from '../result';
import { EncryptSetStateFn, EncryptStep, EncryptableItem, EncryptedItemInput, EncryptedItemInputs } from '../types';
import { encryptExtract, encryptReplace } from './encryptUtils';
import { mockEncrypt } from './mockEncryptInput';
import { sdkStore } from '../sdkStore';
import { hardhat } from 'viem/chains';

export class EncryptInputsBuilder<T extends any[]> {
  private sender: string | undefined;
  private chainId: number | undefined;
  private securityZone: number;
  private stepCallback?: EncryptSetStateFn;
  private zkVerifierUrl: string | undefined;
  private inputItems: [...T];

  private zkBuilder: ZkCiphertextListBuilder;
  private zkCrs: ZkCompactPkeCrs;

  constructor(params: {
    inputs: [...T];
    sender?: string;
    chainId?: number;
    securityZone?: number;
    zkVerifierUrl?: string;

    builder: ZkCiphertextListBuilder;
    crs: ZkCompactPkeCrs;
  }) {
    this.inputItems = params.inputs;
    this.sender = params.sender;
    this.chainId = params.chainId;
    this.securityZone = params.securityZone ?? 0;
    this.zkVerifierUrl = params.zkVerifierUrl;

    this.zkBuilder = params.builder;
    this.zkCrs = params.crs;
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

  getResolvedSender(): string {
    if (this.sender) return this.sender;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SenderUninitialized,
      message:
        'encryptInputs.getResolvedSender(): Sender is not initialized, check that the walletClient is initialized, or manually set it with .setSender()',
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

  getResolvedChainId(): number {
    if (this.chainId) return this.chainId;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ChainIdUninitialized,
      message:
        'encryptInputs.getResolvedChainId(): Chain ID is not initialized, check that the publicClient is initialized, or manually set it with .setChainId()',
    });
  }

  getZkVerifierUrl(): string | undefined {
    return this.zkVerifierUrl;
  }

  getResolvedZkVerifierUrl(): string {
    if (this.zkVerifierUrl) return this.zkVerifierUrl;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkVerifierUrlUninitialized,
      message: 'zkVerifierUrl is not initialized',
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
      message: 'Some encrypted inputs remaining after replacement',
    });
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
      const sender = this.getResolvedSender();
      const chainId = this.getResolvedChainId();
      const zkVerifierUrl = this.getResolvedZkVerifierUrl();

      // On hardhat, interact with MockZkVerifier contract instead of CoFHE
      if (chainId === hardhat.id) {
        return await mockEncrypt(this.inputItems, sender, this.securityZone, this.stepCallback);
      }

      this.fireCallback(EncryptStep.Extract);

      const encryptableItems = this.getExtractedEncryptableItems();

      this.fireCallback(EncryptStep.Pack);

      this.zkBuilder = zkPack(encryptableItems, this.zkBuilder);

      this.fireCallback(EncryptStep.Prove);

      const proof = await zkProve(this.zkBuilder, this.zkCrs, sender, this.securityZone, chainId);

      this.fireCallback(EncryptStep.Verify);

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

export function encryptInputs<T extends any[]>(
  inputs: [...T],
  builder: ZkCiphertextListBuilder,
  crs: ZkCompactPkeCrs
): EncryptInputsBuilder<[...T]> {
  const publicClient = sdkStore.getPublicClient();
  const chainId = publicClient?.chain?.id;

  const walletClient = sdkStore.getWalletClient();
  const sender = walletClient?.account?.address;

  const config = sdkStore.getConfig();
  const zkVerifierUrl = config?.supportedChains.find((chain) => chain.id === chainId)?.verifierUrl;

  return new EncryptInputsBuilder<[...T]>({
    inputs,
    sender,
    chainId,
    zkVerifierUrl,
    builder,
    crs,
  });
}
