import type { ConfigHooks } from 'hardhat/types/hooks';

import { addNetworkPresets, resolvePluginConfig } from '../config.js';

const configHooks: Partial<ConfigHooks> = {
  async extendUserConfig(config, next) {
    return addNetworkPresets(await next(config));
  },
  async resolveUserConfig(userConfig, resolveConfigurationVariable, next) {
    const resolvedConfig = await next(userConfig, resolveConfigurationVariable);
    resolvePluginConfig(userConfig, resolvedConfig);
    return resolvedConfig;
  },
};

export default async (): Promise<Partial<ConfigHooks>> => configHooks;
