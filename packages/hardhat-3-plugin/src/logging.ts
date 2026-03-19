import type { PublicClient, WalletClient } from 'viem';
import chalk from 'chalk';

import { MockTaskManagerArtifact } from '@cofhe/mock-contracts';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';

async function getLoggingEnabled(publicClient: PublicClient): Promise<boolean> {
  return publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'logOps',
    args: [],
  }) as Promise<boolean>;
}

async function setLoggingEnabled(
  publicClient: PublicClient,
  walletClient: WalletClient,
  enabled: boolean,
): Promise<void> {
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'setLogOps',
    args: [enabled],
    account,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

const printLogsEnabledMessage = (closureMessage: string) => {
  console.log('┌──────────────────┬──────────────────────────────────────────────────');
  console.log(`│ [COFHE-MOCKS]    │ ${closureMessage}`);
  console.log('├──────────────────┴──────────────────────────────────────────────────');
};

const printLogsBlockEnd = () => {
  console.log('└─────────────────────────────────────────────────────────────────────');
};

export async function mock_setLoggingEnabled(
  publicClient: PublicClient,
  walletClient: WalletClient,
  enabled: boolean,
  closureName?: string,
): Promise<void> {
  try {
    const initiallyEnabled = await getLoggingEnabled(publicClient);
    await setLoggingEnabled(publicClient, walletClient, enabled);

    if (enabled) {
      printLogsEnabledMessage(`${closureName ? `"${chalk.bold(closureName)}" logs:` : 'Logs:'}`);
    }

    if (!enabled && initiallyEnabled) {
      printLogsBlockEnd();
    }
  } catch (error) {
    console.log(chalk.red('mock_setLoggingEnabled error'), error);
  }
}

export async function mock_withLogs(
  publicClient: PublicClient,
  walletClient: WalletClient,
  closureName: string,
  closure: () => Promise<void>,
): Promise<void> {
  const initiallyEnabled = await getLoggingEnabled(publicClient);

  await setLoggingEnabled(publicClient, walletClient, true);
  printLogsEnabledMessage(`"${chalk.bold(closureName)}" logs:`);
  await closure();
  printLogsBlockEnd();

  if (!initiallyEnabled) {
    await setLoggingEnabled(publicClient, walletClient, false);
  }
}
