import type { Chain, PublicClient, WalletClient } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { CofheChain } from '@cofhe/sdk/chains';
import type { CofheClient, CofheConfig, CofheInputConfig } from '@cofhe/sdk';

export type ClientFactory = {
  createConfig: (config: CofheInputConfig) => CofheConfig;
  createClient: (config: CofheConfig) => CofheClient;
};

export type TestContext = {
  cofheClient: CofheClient;
  publicClient: PublicClient;
  bobWalletClient: WalletClient;
  aliceWalletClient: WalletClient;
  bobAccount: PrivateKeyAccount;
  aliceAccount: PrivateKeyAccount;
  contractAddress: `0x${string}`;
  chainId: number;
};

export type TestChainConfig = {
  id: number;
  label: string;
  viemChain: Chain;
  cofheChain: CofheChain;
  rpc: string;
  txConfirmationsRequired: number;
  enabled: boolean;
  setup: (factory: ClientFactory) => Promise<TestContext>;
  teardown?: () => Promise<void>;
};
