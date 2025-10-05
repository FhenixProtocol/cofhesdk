import { FheTypes, UnsealedItem } from '../types';
import { getThresholdNetworkUrlOrThrow } from '../config';
import { Permit, PermitUtils } from '@cofhesdk/permits';
import { Result, resultWrapper } from '../result';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { permits } from '../permits';
import { isValidUtype, convertViaUtype } from './decryptUtils';
import { BaseBuilder, BaseBuilderParams } from '../builders/baseBuilder';
import { hardhat } from '@cofhesdk/chains';
import { cofheMocksSealOutput } from './cofheMocksSealOutput';
import { tnSealOutput } from './tnSealOutput';

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
 * Returns a Result<UnsealedItem<U>>
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

  private getThresholdNetworkUrl(chainId: number): string {
    const config = this.getConfigOrThrow();
    return getThresholdNetworkUrlOrThrow(config, chainId);
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

    const chainId = await this.getChainIdOrThrow();
    const account = await this.getAccountOrThrow();

    // Fetch with permit hash
    if (this.permitHash) {
      const permit = await permits.getPermit(chainId, account, this.permitHash);
      if (!permit) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.PermitNotFound,
          message: `Permit with hash <${this.permitHash}> not found for account <${account}> and chainId <${chainId}>`,
          hint: 'Ensure the permit exists and is valid.',
          context: {
            chainId,
            account,
            permitHash: this.permitHash,
          },
        });
      }
      return permit;
    }

    // Fetch with active permit
    const permit = await permits.getActivePermit(chainId, account);
    if (!permit) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.PermitNotFound,
        message: `Active permit not found for chainId <${chainId}> and account <${account}>`,
        hint: 'Ensure a permit exists for this account on this chain.',
        context: {
          chainId,
          account,
        },
      });
    }
    return permit;
  }

  /**
   * On hardhat, interact with MockZkVerifier contract instead of CoFHE
   */
  private async mocksSealOutput(permit: Permit): Promise<bigint> {
    return cofheMocksSealOutput(this.ctHash, this.utype, permit, this.getPublicClientOrThrow(), 0);
  }

  /**
   * In the production context, perform a true decryption with the CoFHE coprocessor.
   */
  private async productionSealOutput(chainId: number, permit: Permit): Promise<bigint> {
    const thresholdNetworkUrl = this.getThresholdNetworkUrl(chainId);
    const permission = PermitUtils.getPermission(permit, true);
    const sealed = await tnSealOutput(this.ctHash, chainId, permission, thresholdNetworkUrl);
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
  decrypt(): Promise<Result<UnsealedItem<U>>> {
    return resultWrapper(async () => {
      // Ensure cofhe client is connected
      await this.requireConnectedOrThrow();

      // Ensure utype is valid
      this.validateUtypeOrThrow();

      // Resolve permit
      const permit = await this.getResolvedPermit();

      // Ensure permit validity
      await PermitUtils.validate(permit);

      // Extract chainId from signed permit
      // Use this chainId to fetch the threshold network URL since this.chainId may be undefined
      const chainId = permit._signedDomain!.chainId;

      // Check permit validity on-chain
      // TODO: PermitUtils.validateOnChain(permit, this.publicClient);

      let unsealed: bigint;

      if (chainId === hardhat.id) {
        unsealed = await this.mocksSealOutput(permit);
      } else {
        unsealed = await this.productionSealOutput(chainId, permit);
      }

      return convertViaUtype(this.utype, unsealed);
    });
  }
}
