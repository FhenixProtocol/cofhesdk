import { PublicClient, WalletClient } from 'viem';
import { FheTypes, UnsealedItem } from '../types';
import { CofhesdkConfig } from '../config';
import { EthEncryptedData, Permit, PermitUtils } from '@cofhesdk/permits';
import { Result, resultWrapper } from '../result';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { permits } from '../permits';
import { isValidUtype, convertViaUtype } from './decryptUtils';

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

type DecryptHandlesBuilderParams<U extends FheTypes> = {
  ctHash: bigint;
  utype: U;
  chainId?: number;
  account?: string;
  permitHash?: string;
  permit?: Permit;

  config: CofhesdkConfig | undefined;
  publicClient: PublicClient | undefined;
  walletClient: WalletClient | undefined;
  connectPromise: Promise<Result<boolean>> | undefined;
};

export class DecryptHandlesBuilder<U extends FheTypes> {
  private ctHash: bigint;
  private utype: U;
  private chainId?: number;
  private account?: string;
  private permitHash?: string;
  private permit?: Permit;

  private config: CofhesdkConfig | undefined;
  private publicClient: PublicClient | undefined;
  private walletClient: WalletClient | undefined;
  private connectPromise: Promise<Result<boolean>> | undefined;

  constructor(params: DecryptHandlesBuilderParams<U>) {
    this.ctHash = params.ctHash;
    this.utype = params.utype;
    this.chainId = params.chainId;
    this.account = params.account;
    this.permitHash = params.permitHash;
    this.permit = params.permit;

    this.config = params.config;
    this.publicClient = params.publicClient;
    this.walletClient = params.walletClient;
    this.connectPromise = params.connectPromise;
  }

  setChainId(chainId: number): DecryptHandlesBuilder<U> {
    this.chainId = chainId;
    return this;
  }

  getChainId(): number | undefined {
    return this.chainId;
  }

  async getChainIdOrThrow(): Promise<number> {
    if (this.chainId) return this.chainId;

    let chainId: number | undefined;
    try {
      chainId = await this.publicClient?.getChainId();
    } catch (e) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.PublicWalletGetChainIdFailed,
        message:
          'decryptHandlesBuilder.getChainIdOrThrow(): publicClient.getChainId() failed, check that the publicClient is initialized, or manually set it with .setChainId()',
        cause: e instanceof Error ? e : undefined,
      });
    }

    if (chainId) return chainId;

    throw new CofhesdkError({
      code: CofhesdkErrorCode.ChainIdUninitialized,
      message:
        'decryptHandlesBuilder.getChainIdOrThrow(): Chain ID is not initialized, check that the publicClient is initialized, or manually set it with .setChainId()',
    });
  }

  setAccount(account: string): DecryptHandlesBuilder<U> {
    this.account = account;
    return this;
  }

  getAccount(): string | undefined {
    return this.account;
  }

  async getAccountOrThrow(): Promise<string> {
    if (this.account) return this.account;

    let account: string | undefined;
    try {
      account = (await this.walletClient?.getAddresses())?.[0];
    } catch (e) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.PublicWalletGetAddressesFailed,
        message:
          'decryptHandlesBuilder.getAccountOrThrow(): walletClient.getAddresses() failed, check that the walletClient is initialized, or manually set it with .setAccount()',
        cause: e instanceof Error ? e : undefined,
      });
    }

    if (account) return account;

    throw new CofhesdkError({
      code: CofhesdkErrorCode.AccountUninitialized,
      message:
        'decryptHandlesBuilder.getAccountOrThrow(): Account is not initialized, check that the walletClient is initialized, or manually set it with .setAccount()',
    });
  }

  setPermitHash(permitHash: string): DecryptHandlesBuilder<U> {
    this.permitHash = permitHash;
    return this;
  }

  getPermitHash(): string | undefined {
    return this.permitHash;
  }

  setPermit(permit: Permit): DecryptHandlesBuilder<U> {
    this.permit = permit;
    return this;
  }

  getPermit(): Permit | undefined {
    return this.permit;
  }

  async getResolvedPermit(): Promise<Permit> {
    if (this.permit) return this.permit;

    const chainId = await this.getChainIdOrThrow();
    const account = await this.getAccountOrThrow();

    // Fetch with permit hash
    if (this.permitHash) {
      const permit = await permits.getPermit(chainId, account, this.permitHash);
      if (!permit) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.PermitNotFound,
          message: `Permit with account <${account}> and hash <${this.permitHash}> not found for chainId <${chainId}>`,
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
      });
    }
    return permit;
  }

  getConfigOrThrow(): CofhesdkConfig {
    if (this.config) return this.config;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingConfig,
      message: 'decryptHandlesBuilder.getConfigOrThrow(): Config fetched from sdkStore is not initialized',
    });
  }

  getThresholdNetworkUrlOrThrow(chainId: number): string {
    const config = this.getConfigOrThrow();
    const supportedChain = config.supportedChains.find((chain) => chain.id === chainId);
    if (!supportedChain) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.UnsupportedChain,
        message: `decryptHandlesBuilder.getThresholdNetworkUrlOrThrow(): Unsupported chain <${chainId}>`,
      });
    }

    const thresholdNetworkUrl = supportedChain.thresholdNetworkUrl;
    if (!thresholdNetworkUrl) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.ThresholdNetworkUrlUninitialized,
        message: `decryptHandlesBuilder.getThresholdNetworkUrlOrThrow(): Threshold network URL is not initialized for chain <${chainId}>`,
      });
    }

    return thresholdNetworkUrl;
  }

  decrypt(): Promise<Result<UnsealedItem<U>>> {
    return resultWrapper(async () => {
      // Wait for connection
      if (this.connectPromise) {
        const result = await this.connectPromise;
        if (!result.success) throw result.error;
      }

      // Resolve permit
      const permit = await this.getResolvedPermit();

      // Ensure permit validity
      await PermitUtils.validate(permit);

      // Extract chainId from signed permit
      // Use this chainId to fetch the threshold network URL since this.chainId may be undefined
      const chainId = permit._signedDomain!.chainId;

      // Check permit validity on-chain
      // TODO: PermitUtils.validateOnChain(permit, this.publicClient);

      // Get threshold network URL
      const thresholdNetworkUrl = this.getThresholdNetworkUrlOrThrow(chainId);

      // Extract permission
      const permission = PermitUtils.getPermission(permit, true);

      let sealed: EthEncryptedData | undefined;
      let errorMessage: string | undefined;

      try {
        const body = {
          ct_tempkey: this.ctHash.toString(16).padStart(64, '0'),
          host_chain_id: chainId,
          permit: permission,
        };
        const sealOutputRes = await fetch(`${thresholdNetworkUrl}/sealoutput`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const sealOutput = (await sealOutputRes.json()) as { sealed: EthEncryptedData; error_message: string };
        sealed = sealOutput.sealed;
        errorMessage = sealOutput.error_message;
      } catch (e) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.SealOutputFailed,
          message: `sealOutput request failed`,
        });
      }

      if (sealed == null) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.SealOutputReturnedNull,
          message: `sealed data not found :: ${errorMessage}`,
        });
      }

      const unsealed = PermitUtils.unseal(permit, sealed);

      if (!isValidUtype(this.utype)) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.InvalidUtype,
          message: `invalid utype :: ${this.utype}`,
        });
      }

      return convertViaUtype(this.utype, unsealed);
    });
  }
}
