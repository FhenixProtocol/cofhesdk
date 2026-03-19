import type { TaskOverrideActionFunction } from 'hardhat/types/tasks';
import { createPublicClient, createWalletClient, createTestClient, custom } from 'viem';

import { deployMocks } from '../deploy.js';

const SKIP_ENV_VAR = 'COFHE_SKIP_MOCKS_DEPLOY';

const action: TaskOverrideActionFunction = async (taskArguments, hre, runSuper) => {
  const raw = process.env[SKIP_ENV_VAR] ?? '';
  const skipAutoDeploy = ['1', 'true', 'yes'].includes(raw.trim().toLowerCase());

  if (!skipAutoDeploy) {
    const connection = await hre.network.connect();
    const transport = custom(connection.provider);

    await deployMocks(
      {
        provider: connection.provider,
        publicClient: createPublicClient({ transport }),
        walletClient: createWalletClient({ transport }),
        testClient: createTestClient({ mode: 'hardhat', transport }),
        networkName: connection.networkName,
      },
      {
        deployTestBed: true,
        gasWarning: hre.config.cofhe.gasWarning,
      },
    );
  }

  return runSuper(taskArguments);
};

export default action;
