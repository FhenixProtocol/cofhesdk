import type { ConfigHooks } from 'hardhat/types/hooks';

import { resolvePluginConfig } from '../config.js';

const configHooks: Partial<ConfigHooks> = {
  async resolveUserConfig(userConfig, resolveConfigurationVariable, next) {
    const resolvedConfig = await next(userConfig, resolveConfigurationVariable);
    resolvePluginConfig(userConfig, resolvedConfig);
    return resolvedConfig;
  },
};

export default async (): Promise<Partial<ConfigHooks>> => configHooks;
