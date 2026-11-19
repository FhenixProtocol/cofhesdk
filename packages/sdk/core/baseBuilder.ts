import { type EIP1193RequestFn, type PublicClient, type PublicRpcSchema, type WalletClient } from 'viem';
import { type CofheConfig } from './config.js';
import { CofheError, CofheErrorCode } from './error.js';

/**
 * Base parameters that all builders need
 */
export type BaseBuilderParams = {
  config: CofheConfig | undefined;

  chainId: number | undefined;
  account: string | undefined;

  _mocksRequestFn: EIP1193RequestFn<PublicRpcSchema> | undefined; // Required only for mocks
};

/**
 * Abstract base class for builders that provides common functionality
 * for working with clients, config, and chain IDs
 */
export abstract class BaseBuilder {
  protected config: CofheConfig;

  protected chainId: number | undefined;
  protected account: string | undefined;

  protected _mocksRequestFn: EIP1193RequestFn<PublicRpcSchema> | undefined;

  constructor(params: BaseBuilderParams) {
    // Check that config is provided
    if (!params.config) {
      throw new CofheError({
        code: CofheErrorCode.MissingConfig,
        message: 'Builder config is undefined',
        hint: 'Ensure client has been created with a config.',
        context: {
          config: params.config,
        },
      });
    }
    this.config = params.config;

    this._mocksRequestFn = params._mocksRequestFn;

    this.chainId = params.chainId;
    this.account = params.account;
  }

  /**
   * Asserts that this.chainId is populated
   * @throws {CofheError} If chainId is not set
   */
  protected assertChainId(): asserts this is this & { chainId: number } {
    if (this.chainId) return;
    throw new CofheError({
      code: CofheErrorCode.ChainIdUninitialized,
      message: 'Chain ID is not set',
      hint: 'Ensure client.connect() has been called and awaited, or use setChainId(...) to set the chainId explicitly.',
      context: {
        chainId: this.chainId,
      },
    });
  }

  /**
   * Asserts that this.account is populated
   * @throws {CofheError} If account is not set
   */
  protected assertAccount(): asserts this is this & { account: string } {
    if (this.account) return;
    throw new CofheError({
      code: CofheErrorCode.AccountUninitialized,
      message: 'Account is not set',
      hint: 'Ensure client.connect() has been called and awaited, or use setAccount(...) to set the account explicitly.',
      context: {
        account: this.account,
      },
    });
  }

  /**
   * Asserts that this._mocksRequestFn is populated
   * @throws {CofheError} If _mocksRequestFn is not set
   */
  protected assertMocksRequestFn(): asserts this is this & { _mocksRequestFn: EIP1193RequestFn<PublicRpcSchema> } {
    if (this._mocksRequestFn) return;
    throw new CofheError({
      code: CofheErrorCode.MissingMocksRequestFn,
      message: 'Mocks request function is not set',
      hint: 'Ensure the client is initialized correctly in the hardhat environment.',
      context: {
        _mocksRequestFn: this._mocksRequestFn,
      },
    });
  }
}
