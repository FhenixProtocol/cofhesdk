import type { HardhatPlugin } from 'hardhat/types/plugins';
import { task, overrideTask } from 'hardhat/config';
import { ArgumentType } from 'hardhat/types/arguments';

import { TASK_COFHE_MOCKS_DEPLOY, TASK_COFHE_USE_FAUCET, TASK_COFHE_SET_LOG_OPS } from './consts.js';

import './type-extensions.js';

const plugin: HardhatPlugin = {
  id: '@cofhe/hardhat-3-plugin',

  hookHandlers: {
    config: async () => import('./hooks/config.js'),
    hre: async () => import('./hooks/hre.js'),
  },

  tasks: [
    // ── Custom tasks ────────────────────────────────────────────────────────

    task(TASK_COFHE_MOCKS_DEPLOY, 'Deploy CoFHE mock contracts on the Hardhat network')
      .addFlag({ name: 'silent', description: 'Suppress deployment output' })
      .addFlag({ name: 'deployTestBed', description: 'Also deploy the TestBed contract' })
      .setAction(async () => import('./tasks/deploy-mocks.js'))
      .build(),

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

    // ── Built-in task overrides ──────────────────────────────────────────────

    overrideTask('test')
      .setAction(async () => import('./tasks/run-tests.js'))
      .build(),

    overrideTask('node')
      .setAction(async () => import('./tasks/run-node.js'))
      .build(),
  ],
};

export default plugin;

export * from './consts.js';
export * from './deploy.js';
export * from './fund.js';
export * from './logging.js';
export * from './utils.js';
