import type { NewTaskActionFunction } from 'hardhat/types/tasks';
import { createPublicClient, createWalletClient, custom } from 'viem';

import { mock_setLoggingEnabled } from '../logging.js';

interface SetLogOpsTaskArgs {
  enable: boolean;
}

const action: NewTaskActionFunction<SetLogOpsTaskArgs> = async ({ enable }, hre) => {
  const connection = await hre.network.connect();
  const transport = custom(connection.provider);

  await mock_setLoggingEnabled(createPublicClient({ transport }), createWalletClient({ transport }), enable);
};

export default action;
