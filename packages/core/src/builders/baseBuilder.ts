import { PublicClient, WalletClient } from 'viem';
import { CofhesdkConfig } from '../config';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { Result } from '../result';
import { getPublicClientChainID, getWalletClientAccount } from '../utils';
import { CofhesdkClientConnectReturnType } from '../types';

/**
 * Base parameters that all builders need
 */
export type BaseBuilderParams = {
  config?: CofhesdkConfig | undefined;
  publicClient?: PublicClient | undefined;
  walletClient?: WalletClient | undefined;
  connectPromise?: Promise<Result<CofhesdkClientConnectReturnType>> | undefined;

  chainId?: number;
  account?: string;
};

/**
 * Abstract base class for builders that provides common functionality
 * for working with clients, config, and chain IDs
 */
export abstract class BaseBuilder {
  protected config: CofhesdkConfig | undefined;
  protected publicClient: PublicClient | undefined;
  protected walletClient: WalletClient | undefined;
  protected connectPromise: Promise<Result<CofhesdkClientConnectReturnType>> | undefined;

  protected chainId: number | undefined;
  protected account: string | undefined;

  constructor(params: BaseBuilderParams) {
    this.config = params.config;
    this.publicClient = params.publicClient;
    this.walletClient = params.walletClient;
    this.connectPromise = params.connectPromise;

    this.chainId = params.chainId;
    this.account = params.account;
  }

  /**
   * Waits for the connection promise to resolve
   * @throws {CofhesdkError} If connection fails
   */
  protected async waitForConnection(): Promise<void> {
    if (this.connectPromise) {
      const result = await this.connectPromise;

      // Throw if connect fails
      if (!result.success) throw result.error;

      // Populate the instance with the connection result if empty
      // Only override if not already set
      if (this.publicClient == null && result.data.publicClient) this.publicClient = result.data.publicClient;
      if (this.walletClient == null && result.data.walletClient) this.walletClient = result.data.walletClient;
      if (this.chainId == null && result.data.chainId) this.chainId = result.data.chainId;
      if (this.account == null && result.data.account) this.account = result.data.account;
    }
  }

  /**
   * Gets the chain ID from the instance or fetches it from the public client
   * @returns The chain ID
   * @throws {CofhesdkError} If chainId is not set and publicClient is not available
   */
  protected async getChainIdOrThrow(): Promise<number> {
    if (this.chainId) return this.chainId;

    if (!this.publicClient)
      throw new CofhesdkError({
        code: CofhesdkErrorCode.ChainIdUninitialized,
        message: 'Chain ID is not set and publicClient is not provided',
        hint: 'Ensure client.connect() has been called, or use setChainId(...) to set the chainId explicitly.',
        context: {
          chainId: this.chainId,
          publicClient: this.publicClient,
        },
      });

    return getPublicClientChainID(this.publicClient);
  }

  /**
   * Gets the account address from the instance or fetches it from the wallet client
   * @returns The account address
   * @throws {CofhesdkError} If account is not set and walletClient is not available
   */
  protected async getAccountOrThrow(): Promise<string> {
    if (this.account) return this.account;

    if (!this.walletClient)
      throw new CofhesdkError({
        code: CofhesdkErrorCode.AccountUninitialized,
        message: 'Account is not set and walletClient is not provided',
        hint: 'Ensure client.connect() has been called, or use setAccount(...) to set the account explicitly.',
        context: {
          account: this.account,
          walletClient: this.walletClient,
        },
      });

    return getWalletClientAccount(this.walletClient);
  }

  /**
   * Gets the config or throws an error if not available
   * @returns The config
   * @throws {CofhesdkError} If config is not set
   */
  protected getConfigOrThrow(): CofhesdkConfig {
    if (this.config) return this.config;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingConfig,
      message: 'Builder config is undefined',
      hint: 'Ensure client has been created with a config.',
      context: {
        config: this.config,
      },
    });
  }

  /**
   * Gets the public client or throws an error if not available
   * @returns The public client
   * @throws {CofhesdkError} If publicClient is not set
   */
  protected getPublicClientOrThrow(): PublicClient {
    if (this.publicClient) return this.publicClient;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingPublicClient,
      message: 'Public client not found',
      hint: 'Ensure client.connect() has been called with a publicClient.',
      context: {
        publicClient: this.publicClient,
      },
    });
  }

  /**
   * Gets the wallet client or throws an error if not available
   * @returns The wallet client
   * @throws {CofhesdkError} If walletClient is not set
   */
  protected getWalletClientOrThrow(): WalletClient {
    if (this.walletClient) return this.walletClient;
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingWalletClient,
      message: 'Wallet client not found',
      hint: 'Ensure client.connect() has been called with a walletClient.',
      context: {
        walletClient: this.walletClient,
      },
    });
  }
}
