/* eslint-disable no-dupe-class-members */
import { hardhat } from '@/chains';
import { type ACP, ACPUtils } from '@/acps';

import { FheTypes, type UnsealedItem } from '../types.js';
import { getThresholdNetworkUrlOrThrow } from '../config.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { acps } from '../acps.js';
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
 *   .withACP()              // optional (active acp)
 *   // or .withACP(acpHash) / .withACP(acp)
 *   .execute()
 *
 * If chainId not set, uses client's chainId
 * If account not set, uses client's account
 * withACP() uses chainId + account to get the active acp.
 * withACP(acpHash) fetches that acp using chainId + account.
 * withACP(acp) uses the provided acp regardless of chainId/account.
 *
 * Note: decryptForView always requires a acp (no global-allowance mode).
 *
 * Returns the unsealed item.
 */

type DecryptForViewBuilderParams<U extends FheTypes> = BaseBuilderParams & {
  ctHash: bigint | string;
  utype: U;
  acpHash?: string;
  acp?: ACP;
};

export class DecryptForViewBuilder<U extends FheTypes> extends BaseBuilder {
  private ctHash: bigint | string;
  private utype: U;
  private acpHash?: string;
  private acp?: ACP;
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
    this.acpHash = params.acpHash;
    this.acp = params.acp;
  }

  /**
   * @param chainId - Chain to decrypt values from. Used to fetch the threshold network URL and use the correct acp.
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
   * @param account - Account to decrypt values from. Used to fetch the correct acp.
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
   * Select "use acp" mode (optional).
   *
   * - `withACP(acp)` uses the provided acp.
   * - `withACP(acpHash)` fetches that acp.
   * - `withACP()` uses the active acp for the resolved `chainId + account`.
   */
  withACP(): DecryptForViewBuilder<U>;
  withACP(acpHash: string): DecryptForViewBuilder<U>;
  withACP(acp: ACP): DecryptForViewBuilder<U>;
  withACP(acpOrACPHash?: ACP | string): DecryptForViewBuilder<U> {
    if (typeof acpOrACPHash === 'string') {
      this.acpHash = acpOrACPHash;
      this.acp = undefined;
    } else if (acpOrACPHash === undefined) {
      // Explicitly choose "active acp" resolution at execute()
      this.acpHash = undefined;
      this.acp = undefined;
    } else {
      // ACP object
      this.acp = acpOrACPHash;
      this.acpHash = undefined;
    }

    return this;
  }

  /**
   * @param acpHash - ACP hash to decrypt values from. Used to fetch the correct acp.
   *
   * If not provided, the active acp for the chainId and account will be used.
   * If `setACP()` is called, it will be used regardless of chainId, account, or acpHash.
   *
   * Example:
   * ```typescript
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setACPHash('0x1234567890123456789012345678901234567890')
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForViewBuilder instance.
   */
  /** @deprecated Use `withACP(acpHash)` instead. */
  setACPHash(acpHash: string): DecryptForViewBuilder<U> {
    return this.withACP(acpHash);
  }

  getACPHash(): string | undefined {
    return this.acpHash;
  }

  /**
   * @param acp - ACP to decrypt values with. If provided, it will be used regardless of chainId, account, or acpHash.
   *
   * If not provided, the acp will be determined by chainId, account, and acpHash.
   *
   * Example:
   * ```typescript
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setACP(acp)
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForViewBuilder instance.
   */
  /** @deprecated Use `withACP(acp)` instead. */
  setACP(acp: ACP): DecryptForViewBuilder<U> {
    return this.withACP(acp);
  }

  getACP(): ACP | undefined {
    return this.acp;
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

  private async getResolvedACP(): Promise<ACP> {
    if (this.acp) return this.acp;

    this.assertChainId();
    this.assertAccount();

    // Fetch with acp hash
    if (this.acpHash) {
      const acp = await acps.getACP(this.chainId, this.account, this.acpHash);
      if (!acp) {
        throw new CofheError({
          code: CofheErrorCode.ACPNotFound,
          message: `ACP with hash <${this.acpHash}> not found for account <${this.account}> and chainId <${this.chainId}>`,
          hint: 'Ensure the acp exists and is valid.',
          context: {
            chainId: this.chainId,
            account: this.account,
            acpHash: this.acpHash,
          },
        });
      }
      return acp;
    }

    // Fetch with active acp
    const acp = await acps.getActiveACP(this.chainId, this.account);
    if (!acp) {
      throw new CofheError({
        code: CofheErrorCode.ACPNotFound,
        message: `Active acp not found for chainId <${this.chainId}> and account <${this.account}>`,
        hint: 'Ensure a acp exists for this account on this chain.',
        context: {
          chainId: this.chainId,
          account: this.account,
        },
      });
    }
    return acp;
  }

  /**
   * On hardhat, interact with MockZkVerifier contract instead of CoFHE
   */
  private async mocksSealOutput(acp: ACP): Promise<bigint> {
    this.assertPublicClient();

    // Configurable delay before decrypting the output to simulate the CoFHE decrypt processing time
    // Recommended 1000ms on web
    // Recommended 0ms on hardhat (will be called during tests no need for fake delay)
    const mocksDecryptDelay = this.config.mocks.decryptDelay;
    if (mocksDecryptDelay > 0) await sleep(mocksDecryptDelay);

    return cofheMocksDecryptForView(this.ctHash, this.utype, acp, this.publicClient);
  }

  /**
   * In the production context, perform a true decryption with the CoFHE coprocessor.
   */
  private async productionSealOutput(acp: ACP): Promise<bigint> {
    this.assertChainId();
    this.assertPublicClient();

    const thresholdNetworkUrl = await this.getThresholdNetworkUrl();
    const acp = ACPUtils.getPublic(acp, true);
    // const sealed = await tnSealOutputV1(this.ctHash, this.chainId, permission, thresholdNetworkUrl);
    const sealed = await tnSealOutputV2({
      ctHash: this.ctHash,
      chainId: this.chainId,
      acp,
      thresholdNetworkUrl,
      retry404TimeoutMs: this.retry404TimeoutMs,
      onPoll: this.pollCallback,
    });
    return ACPUtils.unseal(acp, sealed);
  }

  /**
   * Final step of the decryption process. MUST BE CALLED LAST IN THE CHAIN.
   *
   * This will:
   * - Use a acp based on provided acp OR chainId + account + acpHash
   * - Check acp validity
   * - Call CoFHE `/sealoutput` with the acp, which returns a sealed (encrypted) item
   * - Unseal the sealed item with the acp
   * - Return the unsealed item
   *
   * Example:
   * ```typescript
   * const unsealed = await client.decryptForView(ctHash, utype)
   *   .setChainId(11155111)      // optional
   *   .setAccount('0x123...890') // optional
   *   .withACP()              // optional
   *   .execute();                // execute
   * ```
   *
   * @returns The unsealed item.
   */
  async execute(): Promise<UnsealedItem<U>> {
    // Ensure utype is valid
    this.validateUtypeOrThrow();

    // Resolve acp
    const acp = await this.getResolvedACP();

    // Ensure acp validity
    ACPUtils.validate(acp);

    // Extract chainId from signed acp
    // Use this chainId to fetch the threshold network URL since this.chainId may be undefined
    const chainId = acp._signedDomain!.chainId;

    // Check acp validity on-chain
    // TODO: ACPUtils.validateOnChain(acp, this.publicClient);

    let unsealed: bigint;

    if (chainId === hardhat.id) {
      unsealed = await this.mocksSealOutput(acp);
    } else {
      unsealed = await this.productionSealOutput(acp);
    }

    return convertViaUtype(this.utype, unsealed);
  }
}
