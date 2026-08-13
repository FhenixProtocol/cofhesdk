/* eslint-disable no-dupe-class-members */
import { hardhat } from '@/chains';
import { type ACP, type ACPPublic, ACPUtils } from '@/acps';

import { FheTypes } from '../types';
import { getThresholdNetworkUrlOrThrow } from '../config';
import { CofheError, CofheErrorCode } from '../error';
import { acps } from '../acps';
import { BaseBuilder, type BaseBuilderParams } from '../baseBuilder';
import { cofheMocksDecryptForTx } from './cofheMocksDecryptForTx';
import { getPublicClientChainID, sleep } from '../utils';
import { type DecryptPollCallbackFunction } from '../types';
import { tnDecryptV2 } from './tnDecryptV2';

const DEFAULT_404_RETRY_TIMEOUT_MS = 10_000;

/**
 * API
 *
 * await client.decryptForTx(ctHash)
 *   .setChainId(chainId)
 *   .setAccount(account)
 *   .withACP(acp | acpHash | undefined)
 *   // or .withoutACP()
 *   .execute()
 *
 * If chainId not set, uses client's chainId
 * If account not set, uses client's account
 * You MUST choose one acp mode before calling execute():
 *   - withACP(...) to decrypt using a acp
 *   - withoutACP() to decrypt via global allowance (no acp)
 *
 * withACP() (no args / undefined) uses the active acp for chainId + account.
 * withoutACP() uses global allowance (no acp required).
 *
 * Returns the decrypted value + proof ready for tx.
 */

type DecryptForTxACPSelection = 'unset' | 'with-acp' | 'without-acp';

type DecryptForTxBuilderParams = BaseBuilderParams & {
  ctHash: bigint | string;
};

export type DecryptForTxResult = {
  ctHash: bigint | string;
  decryptedValue: bigint;
  signature: `0x${string}`; // Threshold network signature for publishDecryptResult
};

/**
 * Type-level gating:
 * - The initial builder returned from `client.decryptForTx(...)` intentionally does not expose `execute()`.
 * - Calling `withACP(...)` or `withoutACP()` returns a builder that *does* expose `execute()`, but no longer
 *   exposes `withACP/withoutACP` (so you can't select twice, or switch modes).
 */
export type DecryptForTxBuilderUnset = Omit<DecryptForTxBuilder, 'execute'>;

export type DecryptForTxBuilderSelected = Omit<DecryptForTxBuilder, 'withACP' | 'withoutACP'>;

export class DecryptForTxBuilder extends BaseBuilder {
  private ctHash: bigint | string;
  private acpHash?: string;
  private acp?: ACP;
  private acpSelection: DecryptForTxACPSelection = 'unset';
  private pollCallback?: DecryptPollCallbackFunction;
  private retry404TimeoutMs = DEFAULT_404_RETRY_TIMEOUT_MS;

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
   * @param chainId - Chain to decrypt values from. Used to fetch the threshold network URL and use the correct acp.
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
  setChainId(this: DecryptForTxBuilderUnset, chainId: number): DecryptForTxBuilderUnset;
  setChainId(this: DecryptForTxBuilderSelected, chainId: number): DecryptForTxBuilderSelected;
  setChainId(chainId: number): DecryptForTxBuilder {
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
   * const result = await decryptForTx(ctHash)
   *   .setAccount('0x1234567890123456789012345678901234567890')
   *   .execute();
   * ```
   *
   * @returns The chainable DecryptForTxBuilder instance.
   */
  setAccount(this: DecryptForTxBuilderUnset, account: string): DecryptForTxBuilderUnset;
  setAccount(this: DecryptForTxBuilderSelected, account: string): DecryptForTxBuilderSelected;
  setAccount(account: string): DecryptForTxBuilder {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  onPoll(this: DecryptForTxBuilderUnset, callback: DecryptPollCallbackFunction): DecryptForTxBuilderUnset;
  onPoll(this: DecryptForTxBuilderSelected, callback: DecryptPollCallbackFunction): DecryptForTxBuilderSelected;
  onPoll(callback: DecryptPollCallbackFunction): DecryptForTxBuilder {
    this.pollCallback = callback;
    return this;
  }

  set404RetryTimeout(this: DecryptForTxBuilderUnset, timeoutMs: number): DecryptForTxBuilderUnset;
  set404RetryTimeout(this: DecryptForTxBuilderSelected, timeoutMs: number): DecryptForTxBuilderSelected;
  set404RetryTimeout(timeoutMs: number): DecryptForTxBuilder {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: set404RetryTimeout(timeoutMs) expects a finite number greater than or equal to 0.',
        context: {
          timeoutMs,
        },
      });
    }

    this.retry404TimeoutMs = timeoutMs;
    return this;
  }

  /**
   * Select "use acp" mode.
   *
   * - `withACP(acp)` uses the provided acp.
   * - `withACP(acpHash)` fetches that acp.
   * - `withACP()` uses the active acp for the resolved `chainId + account`.
   *
   * Note: "global allowance" (no acp) is ONLY available via `withoutACP()`.
   */
  withACP(): DecryptForTxBuilderSelected;
  withACP(acpHash: string): DecryptForTxBuilderSelected;
  withACP(acp: ACP): DecryptForTxBuilderSelected;
  withACP(acpOrACPHash?: ACP | string): DecryptForTxBuilderSelected {
    if (this.acpSelection === 'with-acp') {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: withACP() can only be selected once.',
        hint: 'Choose the acp mode once. If you need a different acp, start a new decryptForTx() builder chain.',
      });
    }

    if (this.acpSelection === 'without-acp') {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: cannot call withACP() after withoutACP() has been selected.',
        hint: 'Choose exactly one acp mode: either call .withACP(...) or .withoutACP(), but not both.',
      });
    }

    this.acpSelection = 'with-acp';

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

    return this as unknown as DecryptForTxBuilderSelected;
  }

  /**
   * Select "no acp" mode.
   *
   * This uses global allowance (no acp required) and sends an empty permission payload to `/decrypt`.
   */
  withoutACP(): DecryptForTxBuilderSelected {
    if (this.acpSelection === 'without-acp') {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: withoutACP() can only be selected once.',
        hint: 'Choose the acp mode once. If you need a different mode, start a new decryptForTx() builder chain.',
      });
    }

    if (this.acpSelection === 'with-acp') {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: cannot call withoutACP() after withACP() has been selected.',
        hint: 'Choose exactly one acp mode: either call .withACP(...) or .withoutACP(), but not both.',
      });
    }

    this.acpSelection = 'without-acp';
    this.acpHash = undefined;
    this.acp = undefined;
    return this as unknown as DecryptForTxBuilderSelected;
  }

  getACP(): ACP | undefined {
    return this.acp;
  }

  getACPHash(): string | undefined {
    return this.acpHash;
  }

  private async getThresholdNetworkUrl(): Promise<string> {
    this.assertChainId();
    return getThresholdNetworkUrlOrThrow(this.config, this.chainId);
  }

  private async getResolvedACP(): Promise<ACP | null> {
    if (this.acpSelection === 'unset') {
      throw new CofheError({
        code: CofheErrorCode.InternalError,
        message: 'decryptForTx: missing acp selection; call withACP(...) or withoutACP() before execute().',
        hint: 'Call .withACP() to use the active acp, or .withoutACP() for global allowance.',
      });
    }

    if (this.acpSelection === 'without-acp') {
      return null;
    }

    // with-acp mode
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

    // Fetch active acp (default for withACP() with no args)
    const acp = await acps.getActiveACP(this.chainId, this.account);
    if (!acp) {
      throw new CofheError({
        code: CofheErrorCode.ACPNotFound,
        message: `Active acp not found for chainId <${this.chainId}> and account <${this.account}>`,
        hint: 'Create a acp (e.g. client.acp.createSelf(...)) and/or set it active (client.acp.selectActiveACP(hash)).',
        context: {
          chainId: this.chainId,
          account: this.account,
        },
      });
    }
    return acp;
  }

  /**
   * On hardhat, interact with MockThresholdNetwork contract
   */
  private async mocksDecryptForTx(acp: ACP | null): Promise<DecryptForTxResult> {
    this.assertPublicClient();

    // Configurable delay before decrypting to simulate the CoFHE decrypt processing time
    // Recommended 1000ms on web
    // Recommended 0ms on hardhat (will be called during tests no need for fake delay)
    const delay = this.config.mocks.decryptDelay;
    if (delay > 0) await sleep(delay);

    const result = await cofheMocksDecryptForTx(this.ctHash, 0 as FheTypes, acp, this.publicClient);
    return result;
  }

  /**
   * In the production context, perform a true decryption with the CoFHE coprocessor.
   */
  private async productionDecryptForTx(acp: ACP | null): Promise<DecryptForTxResult> {
    this.assertChainId();
    this.assertPublicClient();

    const thresholdNetworkUrl = await this.getThresholdNetworkUrl();

    const acp = acp ? ACPUtils.getPublic(acp, true) : null;
    const { decryptedValue, signature } = await tnDecryptV2({
      ctHash: this.ctHash,
      chainId: this.chainId,
      acp,
      thresholdNetworkUrl,
      retry404TimeoutMs: this.retry404TimeoutMs,
      onPoll: this.pollCallback,
    });

    return {
      ctHash: this.ctHash,
      decryptedValue,
      signature,
    };
  }

  /**
   * Final step of the decryptForTx process. MUST BE CALLED LAST IN THE CHAIN.
   *
   * You must explicitly choose one acp mode before calling `execute()`:
   * - `withACP(acp)` / `withACP(acpHash)` / `withACP()` (active acp)
   * - `withoutACP()` (global allowance)
   */
  async execute(): Promise<DecryptForTxResult> {
    // Resolve acp (can be ACP object or null for global allowance)
    const acp = await this.getResolvedACP();

    // If acp is provided, validate it
    if (acp !== null) {
      // Ensure acp validity
      ACPUtils.validate(acp);

      // Extract chainId from signed acp
      const chainId = acp._signedDomain!.chainId;

      if (chainId === hardhat.id) {
        return await this.mocksDecryptForTx(acp);
      } else {
        return await this.productionDecryptForTx(acp);
      }
    } else {
      // Global allowance - no acp
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
