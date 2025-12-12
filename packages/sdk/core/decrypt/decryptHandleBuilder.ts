import { hardhat } from '@/chains';
import { type Permit, PermitUtils } from '@/permits';

import { FheTypes, type UnsealedItem } from '../types.js';
import { getThresholdNetworkUrlOrThrow } from '../config.js';
import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import { permits } from '../permits.js';
import { isValidUtype, convertViaUtype } from './decryptUtils.js';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder.js';
import { cofheMocksSealOutput } from './cofheMocksSealOutput.js';
import { tnSealOutput } from './tnSealOutput.js';

/**
 * API
 *
 * await client.decryptHandle(ctHash, utype)
 *   .setChainId(chainId)
 *   .setAccount(account)
 *   .setPermitHash(permitHash)
 *   .setPermit(permit)
 *   .decrypt()
 *
 * If chainId not set, uses client's chainId
 * If account not set, uses client's account
 * If permitHash not set, uses chainId and account to get active permit
 * If permit is set, uses permit to decrypt regardless of chainId, account, or permitHash
 *
 * Returns the unsealed item.
 */

type DecryptHandlesBuilderParams<U extends FheTypes> = BaseBuilderParams & {
  ctHash: bigint;
  utype: U;
  permitHash?: string;
  permit?: Permit;
};

export class DecryptHandlesBuilder<U extends FheTypes> extends BaseBuilder {
  private ctHash: bigint;
  private utype: U;
  private permitHash?: string;
  private permit?: Permit;

  constructor(params: DecryptHandlesBuilderParams<U>) {
    super({
      config: params.config,
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      chainId: params.chainId,
      account: params.account,
      requireConnected: params.requireConnected,
    });

    this.ctHash = params.ctHash;
    this.utype = params.utype;
    this.permitHash = params.permitHash;
    this.permit = params.permit;
  }

  /**
   * @param chainId - Chain to decrypt values from. Used to fetch the threshold network URL and use the correct permit.
   *
   * If not provided, the chainId will be fetched from the connected publicClient.
   *
   * Example:
   * ```typescript
   * const unsealed = await decryptHandle(ctHash, utype)
   *   .setChainId(11155111)
   *   .decrypt();
   * ```
   *
   * @returns The chainable DecryptHandlesBuilder instance.
   */
  setChainId(chainId: number): DecryptHandlesBuilder<U> {
    this.chainId = chainId;
    return this;
  }

  getChainId(): number | undefined {
    return this.chainId;
  }

  /**
   * @param account - Account to decrypt values from. Used to fetch the correct permit.
   *
   * If not provided, the account will be fetched from the connected walletClient.
   *
   * Example:
   * ```typescript
   * const unsealed = await decryptHandle(ctHash, utype)
   *   .setAccount('0x1234567890123456789012345678901234567890')
   *   .decrypt();
   * ```
   *
   * @returns The chainable DecryptHandlesBuilder instance.
   */
  setAccount(account: string): DecryptHandlesBuilder<U> {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  /**
   * @param permitHash - Permit hash to decrypt values from. Used to fetch the correct permit.
   *
   * If not provided, the active permit for the chainId and account will be used.
   * If `setPermit()` is called, it will be used regardless of chainId, account, or permitHash.
   *
   * Example:
   * ```typescript
   * const unsealed = await decryptHandle(ctHash, utype)
   *   .setPermitHash('0x1234567890123456789012345678901234567890')
   *   .decrypt();
   * ```
   *
   * @returns The chainable DecryptHandlesBuilder instance.
   */
  setPermitHash(permitHash: string): DecryptHandlesBuilder<U> {
    this.permitHash = permitHash;
    return this;
  }

  getPermitHash(): string | undefined {
    return this.permitHash;
  }

  /**
   * @param permit - Permit to decrypt values with. If provided, it will be used regardless of chainId, account, or permitHash.
   *
   * If not provided, the permit will be determined by chainId, account, and permitHash.
   *
   * Example:
   * ```typescript
   * const unsealed = await decryptHandle(ctHash, utype)
   *   .setPermit(permit)
   *   .decrypt();
   * ```
   *
   * @returns The chainable DecryptHandlesBuilder instance.
   */
  setPermit(permit: Permit): DecryptHandlesBuilder<U> {
    this.permit = permit;
    return this;
  }

  getPermit(): Permit | undefined {
    return this.permit;
  }

  private async getThresholdNetworkUrl(): Promise<string> {
    this.assertChainId();
    return getThresholdNetworkUrlOrThrow(this.config, this.chainId);
  }

  private validateUtypeOrThrow(): void {
    if (!isValidUtype(this.utype))
      throw new CofhesdkError({
        code: CofhesdkErrorCode.InvalidUtype,
        message: `Invalid utype to decrypt to`,
        context: {
          utype: this.utype,
        },
      });
  }

  private async getResolvedPermit(): Promise<Permit> {
    if (this.permit) return this.permit;

    this.assertChainId();
    this.assertAccount();

    // Fetch with permit hash
    if (this.permitHash) {
      const permit = await permits.getPermit(this.chainId, this.account, this.permitHash);
      if (!permit) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.PermitNotFound,
          message: `Permit with hash <${this.permitHash}> not found for account <${this.account}> and chainId <${this.chainId}>`,
          hint: 'Ensure the permit exists and is valid.',
          context: {
            chainId: this.chainId,
            account: this.account,
            permitHash: this.permitHash,
          },
        });
      }
      return permit;
    }

    // Fetch with active permit
    const permit = await permits.getActivePermit(this.chainId, this.account);
    if (!permit) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.PermitNotFound,
        message: `Active permit not found for chainId <${this.chainId}> and account <${this.account}>`,
        hint: 'Ensure a permit exists for this account on this chain.',
        context: {
          chainId: this.chainId,
          account: this.account,
        },
      });
    }
    return permit;
  }

  /**
   * On hardhat, interact with MockZkVerifier contract instead of CoFHE
   */
  private async mocksSealOutput(permit: Permit): Promise<bigint> {
    this.assertPublicClient();

    const mocksSealOutputDelay = this.config.mocks.sealOutputDelay;
    return cofheMocksSealOutput(this.ctHash, this.utype, permit, this.publicClient, mocksSealOutputDelay);
  }

  /**
   * In the production context, perform a true decryption with the CoFHE coprocessor.
   */
  private async productionSealOutput(permit: Permit): Promise<bigint> {
    this.assertChainId();
    this.assertPublicClient();

    const thresholdNetworkUrl = await this.getThresholdNetworkUrl();
    const permission = PermitUtils.getPermission(permit, true);
    const sealed = await tnSealOutput(this.ctHash, this.chainId, permission, thresholdNetworkUrl);
    return PermitUtils.unseal(permit, sealed);
  }

  /**
   * Final step of the decryption process. MUST BE CALLED LAST IN THE CHAIN.
   *
   * This will:
   * - Use a permit based on provided permit OR chainId + account + permitHash
   * - Check permit validity
   * - Call CoFHE `/sealoutput` with the permit, which returns a sealed (encrypted) item
   * - Unseal the sealed item with the permit
   * - Return the unsealed item
   *
   * Example:
   * ```typescript
   * const unsealed = await decryptHandle(ctHash, utype)
   *   .setChainId(11155111)      // optional
   *   .setAccount('0x123...890') // optional
   *   .decrypt();                // execute
   * ```
   *
   * @returns The unsealed item.
   */
  async decrypt(): Promise<UnsealedItem<U>> {
    // Ensure utype is valid
    this.validateUtypeOrThrow();

    // Resolve permit
    const permit = await this.getResolvedPermit();

    // Ensure permit validity
    // TODO: This doesn't validate permit expiration
    // TODO: This doesn't throw, returns a validation result instead
    PermitUtils.validate(permit);

    // TODO: Add this further validation step for the permit
    // TODO: Ensure this throws if the permit is invalid
    PermitUtils.isValid(permit);

    // Extract chainId from signed permit
    // Use this chainId to fetch the threshold network URL since this.chainId may be undefined
    const chainId = permit._signedDomain!.chainId;

    // Check permit validity on-chain
    // TODO: PermitUtils.validateOnChain(permit, this.publicClient);

    let unsealed: bigint;

    if (chainId === hardhat.id) {
      unsealed = await this.mocksSealOutput(permit);
    } else {
      unsealed = await this.productionSealOutput(permit);
    }

    return convertViaUtype(this.utype, unsealed);
  }
}
