import { configVariable } from 'hardhat/config';
import type { HardhatUserConfig, HardhatConfig } from 'hardhat/types/config';
import type { LogMocksDeploy } from './deploy.js';
import { getMockContractsNpmFiles } from './utils.js';

/**
 * Adds the localcofhe, eth-sepolia and arb-sepolia network presets to the user config, each only
 * when the user hasn't defined a network of that name. Hardhat then validates and resolves them
 * like any network the user wrote, so `network.connect()` can open them.
 */
export function addNetworkPresets(userConfig: HardhatUserConfig): HardhatUserConfig {
  const networks = { ...userConfig.networks };
  // Read when a testnet preset is used, not at startup: a PRIVATE_KEY that isn't a private key
  // must not fail every Hardhat command.
  const testnetAccounts = process.env['PRIVATE_KEY'] ? [configVariable('PRIVATE_KEY')] : [];

  if (networks['localcofhe'] === undefined) {
    networks['localcofhe'] = {
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

  if (networks['eth-sepolia'] === undefined) {
    networks['eth-sepolia'] = {
      type: 'http',
      url: process.env['SEPOLIA_RPC_URL'] ?? 'https://ethereum-sepolia.publicnode.com',
      accounts: testnetAccounts,
      chainId: 11155111,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 60_000,
      httpHeaders: {},
    };
  }

  if (networks['arb-sepolia'] === undefined) {
    networks['arb-sepolia'] = {
      type: 'http',
      url: process.env['ARBITRUM_SEPOLIA_RPC_URL'] ?? 'https://sepolia-rollup.arbitrum.io/rpc',
      accounts: testnetAccounts,
      chainId: 421614,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 60_000,
      httpHeaders: {},
    };
  }

  return { ...userConfig, networks };
}

/**
 * Extends the resolved config with the plugin defaults.
 */
export function resolvePluginConfig(userConfig: HardhatUserConfig, resolvedConfig: HardhatConfig): void {
  // Build the mock contracts with the project: a full build removes the artifacts of any file it
  // did not build, including the mocks compiled at startup
  resolvedConfig.solidity.npmFilesToBuild = [
    ...new Set([...resolvedConfig.solidity.npmFilesToBuild, ...getMockContractsNpmFiles()]),
  ];

  // Resolve cofhe plugin config
  resolvedConfig.cofhe = {
    logMocks: userConfig.cofhe?.logMocks ?? false,
    gasWarning: userConfig.cofhe?.gasWarning ?? false,
    gasSummary: userConfig.cofhe?.gasSummary ?? false,
    mocksDeployVerbosity: (userConfig.cofhe?.mocksDeployVerbosity ?? 'v') as LogMocksDeploy,
  };
}
