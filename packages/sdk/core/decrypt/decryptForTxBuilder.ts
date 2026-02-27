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
 *   // or .withoutPermit()
 *   .execute()
 *
 * If chainId not set, uses client's chainId
 * If account not set, uses client's account
 * You MUST choose one permit mode before calling execute():
 *   - withPermit(...) to decrypt using a permit
 *   - withoutPermit() to decrypt via global allowance (no permit)
 *
 * withPermit() (no args / undefined) uses the active permit for chainId + account.
 * withoutPermit() uses global allowance (no permit required).
 *
 * Returns the decrypted value + proof ready for tx.
 */

type DecryptForTxPermitSelection = 'unset' | 'with-permit' | 'without-permit';

type DecryptForTxBuilderParams = BaseBuilderParams & {
  ctHash: bigint;
};

export type DecryptForTxResult = {
  ctHash: bigint;
  decryptedValue: bigint;
  signature: string; // Threshold network signature for publishDecryptResult
};

/**
 * Type-level gating: the initial builder returned from `client.decryptForTx(...)` intentionally does not expose `execute()`.
 *
 * This is implemented as an `Omit<..., 'execute'>` because our d.ts bundling step strips private member types
 * (which makes "phantom private brand" tricks unreliable for consumers).
 */
export type DecryptForTxBuilderUnset = Omit<DecryptForTxBuilder<'unset'>, 'execute'>;

export class DecryptForTxBuilder<TSelection extends DecryptForTxPermitSelection = 'unset'> extends BaseBuilder {
  // Phantom brand to make builder state (TSelection) non-structurally assignable across instantiations.
  // `declare` ensures this does not emit any runtime field.
  private declare readonly __permitSelectionBrand: TSelection;

  private ctHash: bigint;
  private permitHash?: string;
  private permit?: Permit;
  private permitSelection: DecryptForTxPermitSelection = 'unset';

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
  setChainId(chainId: number): DecryptForTxBuilder<TSelection> {
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
  setAccount(account: string): DecryptForTxBuilder<TSelection> {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  /**
   * Select "use permit" mode.
   *
   * - `withPermit(permit)` uses the provided permit.
   * - `withPermit(permitHash)` fetches that permit.
   * - `withPermit()` uses the active permit for the resolved `chainId + account`.
   *
   * Note: "global allowance" (no permit) is ONLY available via `withoutPermit()`.
   */
  withPermit(): DecryptForTxBuilder<'with-permit'>;
  withPermit(permitHash: string): DecryptForTxBuilder<'with-permit'>;
  withPermit(permit: Permit): DecryptForTxBuilder<'with-permit'>;
  withPermit(permitOrPermitHash?: Permit | string): DecryptForTxBuilder<'with-permit'> {
    this.permitSelection = 'with-permit';

    if (typeof permitOrPermitHash === 'string') {
      this.permitHash = permitOrPermitHash;
      this.permit = undefined;
    } else if (permitOrPermitHash === undefined) {
      // Explicitly choose "active permit" resolution at execute()
      this.permitHash = undefined;
      this.permit = undefined;
    } else {
      // Permit object
      this.permit = permitOrPermitHash;
      this.permitHash = undefined;
    }

    return this as unknown as DecryptForTxBuilder<'with-permit'>;
  }

  /**
   * Select "no permit" mode.
   *
   * This uses global allowance (no permit required) and sends an empty permission payload to `/decrypt`.
   */
  withoutPermit(): DecryptForTxBuilder<'without-permit'> {
    this.permitSelection = 'without-permit';
    this.permitHash = undefined;
    this.permit = undefined;
    return this as unknown as DecryptForTxBuilder<'without-permit'>;
  }

  getPermit(): Permit | undefined {
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
    if (this.permitSelection === 'unset') {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: missing permit selection; call withPermit(...) or withoutPermit() before execute().',
        hint: 'Call .withPermit() to use the active permit, or .withoutPermit() for global allowance.',
      });
    }

    if (this.permitSelection === 'without-permit') {
      return null;
    }

    // with-permit mode
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

    // Fetch active permit (default for withPermit() with no args)
    const permit = await permits.getActivePermit(this.chainId, this.account);
    if (!permit) {
      throw new CofheError({
        code: CofheErrorCode.PermitNotFound,
        message: `Active permit not found for chainId <${this.chainId}> and account <${this.account}>`,
        hint: 'Create a permit (e.g. client.permits.createSelf(...)) and/or set it active (client.permits.selectActivePermit(hash)).',
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
   * You must explicitly choose one permit mode before calling `execute()`:
   * - `withPermit(permit)` / `withPermit(permitHash)` / `withPermit()` (active permit)
   * - `withoutPermit()` (global allowance)
   */
  async execute(this: DecryptForTxBuilder<'with-permit' | 'without-permit'>): Promise<DecryptForTxResult> {
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
