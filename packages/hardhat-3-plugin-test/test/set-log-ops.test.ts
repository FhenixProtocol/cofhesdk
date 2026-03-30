import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';

describe('Set Log Ops', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const logOpsAbi = [
    { name: 'logOps', type: 'function', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  ] as const;

  const getLogOps = () =>
    publicClient.readContract({
      address: TASK_MANAGER_ADDRESS,
      abi: logOpsAbi,
      functionName: 'logOps',
    }) as Promise<boolean>;

  beforeEach(async () => {
    await cofhe.mocks.disableLogs();
  });

  it('enableLogs sets logOps to true', async () => {
    assert.equal(await getLogOps(), false);
    await cofhe.mocks.enableLogs();
    assert.equal(await getLogOps(), true);
  });

  it('disableLogs sets logOps to false', async () => {
    await cofhe.mocks.enableLogs();
    assert.equal(await getLogOps(), true);
    await cofhe.mocks.disableLogs();
    assert.equal(await getLogOps(), false);
  });

  it('withLogs enables during closure and restores after', async () => {
    assert.equal(await getLogOps(), false);
    await cofhe.mocks.withLogs('test-closure', async () => {
      assert.equal(await getLogOps(), true);
    });
    assert.equal(await getLogOps(), false);
  });
});
