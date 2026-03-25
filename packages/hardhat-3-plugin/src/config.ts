import type { HardhatUserConfig, HardhatConfig } from 'hardhat/types/config';
import type { LogMocksDeploy } from './deploy.js';

/**
 * Extends the resolved config with plugin defaults and network presets.
 * Mirrors the logic from the v2 plugin's extendConfig callback.
 */
export function resolvePluginConfig(userConfig: HardhatUserConfig, resolvedConfig: HardhatConfig): void {
  // Inject localcofhe network preset if the user hasn't defined it
  if (!userConfig.networks?.['localcofhe']) {
    (resolvedConfig.networks as Record<string, unknown>)['localcofhe'] = {
      type: 'http',
      url: 'http://127.0.0.1:42069',
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 10_000,
      httpHeaders: {},
      accounts: [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
      ],
    };
  }

  // Inject eth-sepolia preset if the user hasn't defined it
  if (!userConfig.networks?.['eth-sepolia']) {
    (resolvedConfig.networks as Record<string, unknown>)['eth-sepolia'] = {
      type: 'http',
      url: process.env['SEPOLIA_RPC_URL'] ?? 'https://ethereum-sepolia.publicnode.com',
      accounts: process.env['PRIVATE_KEY'] ? [process.env['PRIVATE_KEY']] : [],
      chainId: 11155111,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 60_000,
      httpHeaders: {},
    };
  }

  // Inject arb-sepolia preset if the user hasn't defined it
  if (!userConfig.networks?.['arb-sepolia']) {
    (resolvedConfig.networks as Record<string, unknown>)['arb-sepolia'] = {
      type: 'http',
      url: process.env['ARBITRUM_SEPOLIA_RPC_URL'] ?? 'https://sepolia-rollup.arbitrum.io/rpc',
      accounts: process.env['PRIVATE_KEY'] ? [process.env['PRIVATE_KEY']] : [],
      chainId: 421614,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 60_000,
      httpHeaders: {},
    };
  }

  // Resolve cofhe plugin config
  resolvedConfig.cofhe = {
    logMocks: userConfig.cofhe?.logMocks ?? false,
    gasWarning: userConfig.cofhe?.gasWarning ?? false,
    mocksDeployVerbosity: (userConfig.cofhe?.mocksDeployVerbosity ?? 'v') as LogMocksDeploy,
  };
}
