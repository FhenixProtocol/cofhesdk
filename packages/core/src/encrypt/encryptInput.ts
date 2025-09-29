/* eslint-disable no-unused-vars */

import { ZkPackProveVerify } from './zkPackProveVerify';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { Result, resultWrapper } from '../result';
import { EncryptSetStateFn, EncryptStep, EncryptedItemInput, EncryptedItemInputs } from '../types';
import { encryptExtract, encryptReplace } from './encryptUtils';
import { mockEncrypt } from './mockEncryptInput';

export class EncryptInputsBuilder<T extends any[]> {
  private sender: string;
  private chainId: string;
  private isTestnet: boolean;
  private securityZone: number;
  private stepCallback?: EncryptSetStateFn;
  private inputItems: [...T];
  private zkVerifierUrl: string;
  private zk: ZkPackProveVerify<any>;

  constructor(params: {
    inputs: [...T];
    sender: string;
    chainId: string;
    isTestnet: boolean;
    securityZone?: number;
    zkVerifierUrl: string;
    zk: ZkPackProveVerify<any>;
  }) {
    this.inputItems = params.inputs;
    this.sender = params.sender;
    this.chainId = params.chainId;
    this.isTestnet = params.isTestnet;
    this.securityZone = params.securityZone ?? 0;
    this.zkVerifierUrl = params.zkVerifierUrl;
    this.zk = params.zk;
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

  getSender(): string {
    return this.sender;
  }

  setSecurityZone(securityZone: number): EncryptInputsBuilder<T> {
    this.securityZone = securityZone;
    return this;
  }

  getSecurityZone(): number {
    return this.securityZone;
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
    if (this.isTestnet)
      return resultWrapper(async () => await mockEncrypt(this.inputItems, this.securityZone, this.stepCallback));

    return resultWrapper(async () => {
      this.fireCallback(EncryptStep.Extract);

      const encryptableItems = this.getExtractedEncryptableItems();

      this.fireCallback(EncryptStep.Pack);

      this.zk.pack(encryptableItems);

      this.fireCallback(EncryptStep.Prove);

      await this.zk.prove(this.sender, this.securityZone, this.chainId);

      this.fireCallback(EncryptStep.Verify);

      const verifyResults = await this.zk.verify(this.zkVerifierUrl, this.sender, this.securityZone, this.chainId);

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
