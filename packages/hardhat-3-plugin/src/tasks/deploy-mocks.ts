import type { NewTaskActionFunction } from 'hardhat/types/tasks';
import { createPublicClient, createWalletClient, createTestClient, custom } from 'viem';

import { deployMocks } from '../deploy.js';

interface DeployMocksTaskArgs {
  deployTestBed: boolean;
  silent: boolean;
}

const action: NewTaskActionFunction<DeployMocksTaskArgs> = async (
  { deployTestBed, silent },
  hre,
) => {
  const connection = await hre.network.connect();
  const transport = custom(connection.provider);

  const ctx = {
    provider: connection.provider,
    publicClient: createPublicClient({ transport }),
    walletClient: createWalletClient({ transport }),
    testClient: createTestClient({ mode: 'hardhat', transport }),
    networkName: connection.networkName,
  };

  await deployMocks(ctx, {
    deployTestBed,
    gasWarning: hre.config.cofhe.gasWarning,
    silent,
  });
};

export default action;
