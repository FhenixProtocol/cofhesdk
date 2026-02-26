import { hardhat } from '@/chains';
import { type Permit, type Permission, PermitUtils } from '@/permits';

import { FheTypes } from '../types.js';
import { getThresholdNetworkUrlOrThrow } from '../config.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { permits } from '../permits.js';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder.js';
import { cofheMocksDecryptForTx } from './cofheMocksDecryptForTx.js';
import { getPublicClientChainID } from '../utils.js';
import { tnDecrypt } from './tnDecrypt.js';

/**
 * API
 *
 * await client.decryptForTx(ctHash)
 *   .setChainId(chainId)
 *   .setAccount(account)
 *   .withPermit(permit | permitHash | undefined)
 *   .execute()
 *
 * If chainId not set, uses client's chainId
 * If account not set, uses client's account
 * If withPermit not called, uses active permit from chainId + account
 * If withPermit(undefined/null), uses global allowance (no permit required)
 *
 * Returns the decrypted value + proof ready for tx.
 */

type DecryptForTxBuilderParams = BaseBuilderParams & {
  ctHash: bigint;
  permitHash?: string;
  permit?: Permit | null;
};

export type DecryptForTxResult = {
  ctHash: bigint;
  decryptedValue: bigint;
  signature: string; // Threshold network signature for publishDecryptResult
};

export class DecryptForTxBuilder extends BaseBuilder {
  private ctHash: bigint;
  private permitHash?: string;
  private permit?: Permit | null;
  private permitSet = false; // Track if withPermit was explicitly called

  constructor(params: DecryptForTxBuilderParams) {
    super({
      config: params.config,
      publicClient: params.publicClient,
      walletClient: params.walletClient,
      chainId: params.chainId,
      account: params.account,
      requireConnected: params.requireConnected,
    });

    this.ctHash = params.ctHash;
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
   * const result = await decryptForTx(ctHash)
   *   .setChainId(11155111)
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForTxBuilder instance.
   */
  setChainId(chainId: number): DecryptForTxBuilder {
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
   * const result = await decryptForTx(ctHash)
   *   .setAccount('0x1234567890123456789012345678901234567890')
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForTxBuilder instance.
   */
  setAccount(account: string): DecryptForTxBuilder {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  /**
   * @param permitHashOrPermitOrUndefined - Permit hash to fetch, Permit object to use directly, or undefined for global allowance.
   *
   * If a string is provided, it's treated as a permit hash and will be fetched.
   * If a Permit object is provided, it will be used directly.
   * If undefined/null is provided, uses global allowance (no permit required).
   * If not called, fetches the active permit for the chainId + account.
   *
   * Example with permit hash:
   * ```typescript
   * const result = await decryptForTx(ctHash)
   *   .withPermit('0x1234567890123456789012345678901234567890')
   *   .execute();
   * ```
   *
   * Example with permit object:
   * ```typescript
   * const result = await decryptForTx(ctHash)
   *   .withPermit(permit)
   *   .execute();
   * ```
   *
   * Example with global allowance (no permit):
   * ```typescript
   * const result = await decryptForTx(ctHash)
   *   .withPermit(undefined)
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForTxBuilder instance.
   */
  withPermit(permitHashOrPermitOrUndefined: string | Permit | undefined | null): DecryptForTxBuilder {
    this.permitSet = true;

    if (typeof permitHashOrPermitOrUndefined === 'string') {
      this.permitHash = permitHashOrPermitOrUndefined;
      this.permit = undefined;
    } else if (permitHashOrPermitOrUndefined === undefined || permitHashOrPermitOrUndefined === null) {
      // Global allowance - no permit required
      this.permit = null;
      this.permitHash = undefined;
    } else {
      // Permit object
      this.permit = permitHashOrPermitOrUndefined;
      this.permitHash = undefined;
    }

    return this;
  }

  getPermit(): Permit | null | undefined {
    return this.permit;
  }

  getPermitHash(): string | undefined {
    return this.permitHash;
  }

  private async getThresholdNetworkUrl(): Promise<string> {
    this.assertChainId();
    return getThresholdNetworkUrlOrThrow(this.config, this.chainId);
  }

  private buildEmptyPermission(): Permission {
    return {
      issuer: '0x0000000000000000000000000000000000000000',
      expiration: 0,
      recipient: '0x0000000000000000000000000000000000000000',
      validatorId: 0,
      validatorContract: '0x0000000000000000000000000000000000000000',
      sealingKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
      issuerSignature: '0x',
      recipientSignature: '0x',
    };
  }

  private async getResolvedPermit(): Promise<Permit | null> {
    // If permit was explicitly set via withPermit()
    if (this.permitSet) {
      return this.permit ?? null;
    }

    // If permit object directly provided
    if (this.permit) return this.permit;

    this.assertChainId();
    this.assertAccount();

    // Fetch with permit hash
    if (this.permitHash) {
      const permit = await permits.getPermit(this.chainId, this.account, this.permitHash);
      if (!permit) {
        throw new CofheError({
          code: CofheErrorCode.PermitNotFound,
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
      throw new CofheError({
        code: CofheErrorCode.PermitNotFound,
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
   * On hardhat, interact with MockThresholdNetwork contract
   */
  private async mocksDecryptForTx(permit: Permit | null): Promise<DecryptForTxResult> {
    this.assertPublicClient();

    const delay = this.config.mocks.sealOutputDelay;
    const result = await cofheMocksDecryptForTx(this.ctHash, 0 as FheTypes, permit, this.publicClient, delay);
    return result;
  }

  /**
   * In the production context, perform a true decryption with the CoFHE coprocessor.
   */
  private async productionDecryptForTx(permit: Permit | null): Promise<DecryptForTxResult> {
    this.assertChainId();
    this.assertPublicClient();

    const thresholdNetworkUrl = await this.getThresholdNetworkUrl();

    const permission = permit ? PermitUtils.getPermission(permit, true) : this.buildEmptyPermission();
    const { decryptedValue, signature } = await tnDecrypt(this.ctHash, this.chainId, permission, thresholdNetworkUrl);

    return {
      ctHash: this.ctHash,
      decryptedValue,
      signature,
    };
  }

  /**
   * Final step of the decryptForTx process. MUST BE CALLED LAST IN THE CHAIN.
   *
   * This will:
   * - Use a permit based on:
   *   - withPermit(permit) if provided
   *   - withPermit(permitHash) to fetch permit
   *   - withPermit(undefined) for global allowance (no permit)
   *   - or active permit for chainId + account
   * - Call CoFHE `/decrypt` with the permit or empty permit for global allowance
   * - Return the decrypted value + proof ready for transaction
   *
   * Example:
   * ```typescript
   * // With permit
   * const result = await client.decryptForTx(ctHash)
   *   .setChainId(11155111)
   *   .setAccount('0x123...890')
   *   .execute();
   *
   * // With global allowance
   * const result = await client.decryptForTx(ctHash)
   *   .withPermit(undefined)
   *   .execute();
   * ```
   *
   * @returns Object containing decrypted value and proof ready for tx.
   */
  async execute(): Promise<DecryptForTxResult> {
    // Resolve permit (can be Permit object or null for global allowance)
    const permit = await this.getResolvedPermit();

    // If permit is provided, validate it
    if (permit !== null) {
      // Ensure permit validity
      PermitUtils.validate(permit);
      PermitUtils.isValid(permit);

      // Extract chainId from signed permit
      const chainId = permit._signedDomain!.chainId;

      if (chainId === hardhat.id) {
        return await this.mocksDecryptForTx(permit);
      } else {
        return await this.productionDecryptForTx(permit);
      }
    } else {
      // Global allowance - no permit
      // If chainId not set, try to get it from publicClient
      if (!this.chainId) {
        this.assertPublicClient();
        this.chainId = await getPublicClientChainID(this.publicClient);
      }

      this.assertChainId();

      if (this.chainId === hardhat.id) {
        return await this.mocksDecryptForTx(null);
      } else {
        return await this.productionDecryptForTx(null);
      }
    }
  }
}
