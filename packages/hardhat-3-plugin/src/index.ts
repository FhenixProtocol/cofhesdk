import type { HardhatPlugin } from 'hardhat/types/plugins';
import { task } from 'hardhat/config';
import { ArgumentType } from 'hardhat/types/arguments';

import { TASK_COFHE_USE_FAUCET, TASK_COFHE_SET_LOG_OPS } from './consts.js';

import './type-extensions.js';

const plugin: HardhatPlugin = {
  id: '@cofhe/hardhat-3-plugin',

  hookHandlers: {
    config: async () => import('./hooks/config.js'),
    hre: async () => import('./hooks/hre.js'),
  },

  tasks: [
    task(TASK_COFHE_USE_FAUCET, 'Fund an account via the localcofhe faucet')
      .addOption({
        name: 'address',
        description: 'Address to fund',
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined,
      })
      .setAction(async () => import('./tasks/use-faucet.js'))
      .build(),

    task(TASK_COFHE_SET_LOG_OPS, 'Enable or disable CoFHE mock contract logging')
      .addFlag({ name: 'enable', description: 'Whether to enable logging' })
      .setAction(async () => import('./tasks/set-log-ops.js'))
      .build(),
  ],
};

export default plugin;

export * from './consts.js';
export * from './deploy.js';
export * from './fund.js';
export * from './logging.js';
export * from './utils.js';
