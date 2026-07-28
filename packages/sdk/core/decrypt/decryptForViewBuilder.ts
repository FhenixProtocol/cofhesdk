/* eslint-disable no-dupe-class-members */
import { hardhat } from '@/chains';
import { type ACP, ACPUtils } from '@/permits';

import { FheTypes, type UnsealedItem } from '../types.js';
import { getThresholdNetworkUrlOrThrow } from '../config.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { permits } from '../permits.js';
import { isValidUtype, convertViaUtype } from './decryptUtils.js';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder.js';
import { cofheMocksDecryptForView } from './cofheMocksDecryptForView.js';
// import { tnSealOutputV1 } from './tnSealOutputV1.js';
import { tnSealOutputV2 } from './tnSealOutputV2.js';
import { sleep } from '../utils.js';
import { type DecryptPollCallbackFunction } from '../types.js';

const DEFAULT_404_RETRY_TIMEOUT_MS = 10_000;

/**
 * API
 *
 * await client.decryptForView(ctHash, utype)
 *   .setChainId(chainId)
 *   .setAccount(account)
 *   .withPermit()              // optional (active permit)
 *   // or .withPermit(permitHash) / .withPermit(permit)
 *   .execute()
 *
 * If chainId not set, uses client's chainId
 * If account not set, uses client's account
 * withPermit() uses chainId + account to get the active permit.
 * withPermit(permitHash) fetches that permit using chainId + account.
 * withPermit(permit) uses the provided permit regardless of chainId/account.
 *
 * Note: decryptForView always requires a permit (no global-allowance mode).
 *
 * Returns the unsealed item.
 */

type DecryptForViewBuilderParams<U extends FheTypes> = BaseBuilderParams & {
  ctHash: bigint | string;
  utype: U;
  permitHash?: string;
  permit?: ACP;
};

export class DecryptForViewBuilder<U extends FheTypes> extends BaseBuilder {
  private ctHash: bigint | string;
  private utype: U;
  private permitHash?: string;
  private permit?: ACP;
  private pollCallback?: DecryptPollCallbackFunction;
  private retry404TimeoutMs = DEFAULT_404_RETRY_TIMEOUT_MS;

  constructor(params: DecryptForViewBuilderParams<U>) {
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
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setChainId(11155111)
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForViewBuilder instance.
   */
  setChainId(chainId: number): DecryptForViewBuilder<U> {
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
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setAccount('0x1234567890123456789012345678901234567890')
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForViewBuilder instance.
   */
  setAccount(account: string): DecryptForViewBuilder<U> {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  onPoll(callback: DecryptPollCallbackFunction): DecryptForViewBuilder<U> {
    this.pollCallback = callback;
    return this;
  }

  set404RetryTimeout(timeoutMs: number): DecryptForViewBuilder<U> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForView: set404RetryTimeout(timeoutMs) expects a finite number greater than or equal to 0.',
        context: {
          timeoutMs,
        },
      });
    }

    this.retry404TimeoutMs = timeoutMs;
    return this;
  }

  /**
   * Select "use permit" mode (optional).
   *
   * - `withPermit(permit)` uses the provided permit.
   * - `withPermit(permitHash)` fetches that permit.
   * - `withPermit()` uses the active permit for the resolved `chainId + account`.
   */
  withPermit(): DecryptForViewBuilder<U>;
  withPermit(permitHash: string): DecryptForViewBuilder<U>;
  withPermit(permit: ACP): DecryptForViewBuilder<U>;
  withPermit(permitOrPermitHash?: ACP | string): DecryptForViewBuilder<U> {
    if (typeof permitOrPermitHash === 'string') {
      this.permitHash = permitOrPermitHash;
      this.permit = undefined;
    } else if (permitOrPermitHash === undefined) {
      // Explicitly choose "active permit" resolution at execute()
      this.permitHash = undefined;
      this.permit = undefined;
    } else {
      // ACP object
      this.permit = permitOrPermitHash;
      this.permitHash = undefined;
    }

    return this;
  }

  /**
   * @param permitHash - ACP hash to decrypt values from. Used to fetch the correct permit.
   *
   * If not provided, the active permit for the chainId and account will be used.
   * If `setPermit()` is called, it will be used regardless of chainId, account, or permitHash.
   *
   * Example:
   * ```typescript
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setPermitHash('0x1234567890123456789012345678901234567890')
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForViewBuilder instance.
   */
  /** @deprecated Use `withPermit(permitHash)` instead. */
  setPermitHash(permitHash: string): DecryptForViewBuilder<U> {
    return this.withPermit(permitHash);
  }

  getPermitHash(): string | undefined {
    return this.permitHash;
  }

  /**
   * @param permit - ACP to decrypt values with. If provided, it will be used regardless of chainId, account, or permitHash.
   *
   * If not provided, the permit will be determined by chainId, account, and permitHash.
   *
   * Example:
   * ```typescript
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setPermit(permit)
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForViewBuilder instance.
   */
  /** @deprecated Use `withPermit(permit)` instead. */
  setPermit(permit: ACP): DecryptForViewBuilder<U> {
    return this.withPermit(permit);
  }

  getPermit(): ACP | undefined {
    return this.permit;
  }

  private async getThresholdNetworkUrl(): Promise<string> {
    this.assertChainId();
    return getThresholdNetworkUrlOrThrow(this.config, this.chainId);
  }

  private validateUtypeOrThrow(): void {
    if (!isValidUtype(this.utype))
      throw new CofheError({
        code: CofheErrorCode.InvalidUtype,
        message: `Invalid utype to decrypt to`,
        context: {
          utype: this.utype,
        },
      });
  }

  private async getResolvedPermit(): Promise<ACP> {
    if (this.permit) return this.permit;

    this.assertChainId();
    this.assertAccount();

    // Fetch with permit hash
    if (this.permitHash) {
      const permit = await permits.getPermit(this.chainId, this.account, this.permitHash);
      if (!permit) {
        throw new CofheError({
          code: CofheErrorCode.PermitNotFound,
          message: `ACP with hash <${this.permitHash}> not found for account <${this.account}> and chainId <${this.chainId}>`,
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
   * On hardhat, interact with MockZkVerifier contract instead of CoFHE
   */
  private async mocksSealOutput(permit: ACP): Promise<bigint> {
    this.assertPublicClient();

    // Configurable delay before decrypting the output to simulate the CoFHE decrypt processing time
    // Recommended 1000ms on web
    // Recommended 0ms on hardhat (will be called during tests no need for fake delay)
    const mocksDecryptDelay = this.config.mocks.decryptDelay;
    if (mocksDecryptDelay > 0) await sleep(mocksDecryptDelay);

    return cofheMocksDecryptForView(this.ctHash, this.utype, permit, this.publicClient);
  }

  /**
   * In the production context, perform a true decryption with the CoFHE coprocessor.
   */
  private async productionSealOutput(permit: ACP): Promise<bigint> {
    this.assertChainId();
    this.assertPublicClient();

    const thresholdNetworkUrl = await this.getThresholdNetworkUrl();
    const acp = ACPUtils.getPublic(permit, true);
    // const sealed = await tnSealOutputV1(this.ctHash, this.chainId, permission, thresholdNetworkUrl);
    const sealed = await tnSealOutputV2({
      ctHash: this.ctHash,
      chainId: this.chainId,
      acp,
      thresholdNetworkUrl,
      retry404TimeoutMs: this.retry404TimeoutMs,
      onPoll: this.pollCallback,
    });
    return ACPUtils.unseal(permit, sealed);
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
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setChainId(11155111)      // optional
   *   .setAccount('0x123...890') // optional
   *   .withPermit()              // optional
   *   .execute();                // execute
   * ```
   *
   * @returns The unsealed item.
   */
  async execute(): Promise<UnsealedItem<U>> {
    // Ensure utype is valid
    this.validateUtypeOrThrow();

    // Resolve permit
    const permit = await this.getResolvedPermit();

    // Ensure permit validity
    ACPUtils.validate(permit);

    // Extract chainId from signed permit
    // Use this chainId to fetch the threshold network URL since this.chainId may be undefined
    const chainId = permit._signedDomain!.chainId;

    // Check permit validity on-chain
    // TODO: ACPUtils.validateOnChain(permit, this.publicClient);

    let unsealed: bigint;

    if (chainId === hardhat.id) {
      unsealed = await this.mocksSealOutput(permit);
    } else {
      unsealed = await this.productionSealOutput(permit);
    }

    return convertViaUtype(this.utype, unsealed);
  }
}
