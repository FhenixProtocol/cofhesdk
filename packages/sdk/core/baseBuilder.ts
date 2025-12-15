import { type PublicClient, type WalletClient } from 'viem';
import { type CofhesdkConfig } from './config.js';
import { CofhesdkError, CofhesdkErrorCode } from './error.js';

/**
 * Base parameters that all builders need
 */
export type BaseBuilderParams = {
  config: CofhesdkConfig | undefined;
  publicClient: PublicClient | undefined;
  walletClient: WalletClient | undefined;

  chainId: number | undefined;
  account: string | undefined;

  requireConnected: (() => void) | undefined;
};

/**
 * Abstract base class for builders that provides common functionality
 * for working with clients, config, and chain IDs
 */
export abstract class BaseBuilder {
  protected config: CofhesdkConfig;

  protected publicClient: PublicClient | undefined;
  protected walletClient: WalletClient | undefined;

  protected chainId: number | undefined;
  protected account: string | undefined;

  constructor(params: BaseBuilderParams) {
    // Check that config is provided
    if (!params.config) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.MissingConfig,
        message: 'Builder config is undefined',
        hint: 'Ensure client has been created with a config.',
        context: {
          config: params.config,
        },
      });
    }
    this.config = params.config;

    this.publicClient = params.publicClient;
    this.walletClient = params.walletClient;

    this.chainId = params.chainId;
    this.account = params.account;

    // Require the client to be connected if passed as param
    params.requireConnected?.();
  }

  /**
   * Asserts that this.chainId is populated
   * @throws {CofhesdkError} If chainId is not set
   */
  protected assertChainId(): asserts this is this & { chainId: number } {
    if (this.chainId) return;
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
   * Asserts that this.account is populated
   * @throws {CofhesdkError} If account is not set
   */
  protected assertAccount(): asserts this is this & { account: string } {
    if (this.account) return;
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
   * Asserts that this.publicClient is populated
   * @throws {CofhesdkError} If publicClient is not set
   */
  protected assertPublicClient(): asserts this is this & { publicClient: PublicClient } {
    if (this.publicClient) return;
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
   * Asserts that this.walletClient is populated
   * @throws {CofhesdkError} If walletClient is not set
   */
  protected assertWalletClient(): asserts this is this & { walletClient: WalletClient } {
    if (this.walletClient) return;
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
