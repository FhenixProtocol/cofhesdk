import type { NewTaskActionFunction } from 'hardhat/types/tasks';
import { createPublicClient, createWalletClient, custom } from 'viem';
import chalk from 'chalk';

import { localcofheFundAccount } from '../fund.js';

interface UseFaucetTaskArgs {
  address: string | undefined;
}

const action: NewTaskActionFunction<UseFaucetTaskArgs> = async ({ address }, hre) => {
  const connection = await hre.network.connect();

  if (connection.networkName !== 'localcofhe') {
    console.info(chalk.yellow('Programmatic faucet only supported for localcofhe'));
    return;
  }

  if (!address) {
    console.info(chalk.red('Failed to get address to fund'));
    return;
  }

  console.info(chalk.green(`Getting funds from faucet for ${address}`));

  const transport = custom(connection.provider);

  try {
    await localcofheFundAccount(
      createPublicClient({ transport }),
      createWalletClient({ transport }),
      address as `0x${string}`
    );
  } catch (e) {
    console.info(chalk.red(`Failed to get funds from localcofhe for ${address}: ${e}`));
  }
};

export default action;
