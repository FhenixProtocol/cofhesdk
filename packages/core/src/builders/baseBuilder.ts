import { PublicClient, WalletClient } from 'viem';
import { CofhesdkConfig } from '../config';
import { CofhesdkError, CofhesdkErrorCode } from '../error';

/**
 * Base parameters that all builders need
 */
export type BaseBuilderParams = {
  config?: CofhesdkConfig | undefined;
  publicClient?: PublicClient | undefined;
  walletClient?: WalletClient | undefined;

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

  protected chainId: number | undefined;
  protected account: string | undefined;

  constructor(params: BaseBuilderParams) {
    this.config = params.config;
    this.publicClient = params.publicClient;
    this.walletClient = params.walletClient;

    this.chainId = params.chainId;
    this.account = params.account;
  }

  /**
   * Gets the chain ID from the instance or fetches it from the public client
   * @returns The chain ID
   * @throws {CofhesdkError} If chainId is not set and publicClient is not available
   */
  protected async getChainIdOrThrow(): Promise<number> {
    if (this.chainId) return this.chainId;

    throw new CofhesdkError({
      code: CofhesdkErrorCode.ChainIdUninitialized,
      message: 'Chain ID is not set',
      hint: 'Ensure client.connect() has been called and awaited, or use setChainId(...) to set the chainId explicitly.',
      context: {
        chainId: this.chainId,
      },
    });
  }

  /**
   * Gets the account address from the instance or fetches it from the wallet client
   * @returns The account address
   * @throws {CofhesdkError} If account is not set and walletClient is not available
   */
  protected async getAccountOrThrow(): Promise<string> {
    if (this.account) return this.account;

    throw new CofhesdkError({
      code: CofhesdkErrorCode.AccountUninitialized,
      message: 'Account is not set',
      hint: 'Ensure client.connect() has been called and awaited, or use setAccount(...) to set the account explicitly.',
      context: {
        account: this.account,
      },
    });
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
