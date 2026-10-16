import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import cofhePlugin from '@cofhe/hardhat-3-plugin';
import hardhatViem from '@nomicfoundation/hardhat-viem';
import { MOCKS_TASK_MANAGER_ADDRESS } from '@cofhe/sdk';

describe('Set Log Ops', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const logOpsAbi = [
    { name: 'logOps', type: 'function', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  ] as const;

  const getLogOps = () =>
    publicClient.readContract({
      address: MOCKS_TASK_MANAGER_ADDRESS,
      abi: logOpsAbi,
      functionName: 'logOps',
    });

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

  it('withLogs restores logOps even if closure throws', async () => {
    assert.equal(await getLogOps(), false);
    await assert.rejects(
      () =>
        cofhe.mocks.withLogs('throwing-closure', async () => {
          assert.equal(await getLogOps(), true);
          throw new Error('boom');
        }),
      /boom/
    );
    assert.equal(await getLogOps(), false);
  });
});

describe('cofhe.logMocks config', () => {
  it('logMocks: true turns logging on when the mocks are deployed', async () => {
    const hre = await createHardhatRuntimeEnvironment(
      {
        solidity: { version: '0.8.28' },
        plugins: [cofhePlugin, hardhatViem],
        cofhe: { logMocks: true, mocksDeployVerbosity: '' },
      },
      {},
      process.cwd()
    );
    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();

    const logOps = await publicClient.readContract({
      address: MOCKS_TASK_MANAGER_ADDRESS,
      abi: [{ name: 'logOps', type: 'function', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' }],
      functionName: 'logOps',
    });
    assert.equal(logOps, true);
  });

  it('logMocks: true turns logging back on when cofhe.mocks.deployMocks() re-deploys', async () => {
    const hre = await createHardhatRuntimeEnvironment(
      {
        solidity: { version: '0.8.28' },
        plugins: [cofhePlugin, hardhatViem],
        cofhe: { logMocks: true, mocksDeployVerbosity: '' },
      },
      {},
      process.cwd()
    );
    const { viem, cofhe } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();

    await cofhe.mocks.disableLogs();
    await cofhe.mocks.deployMocks();

    const logOps = await publicClient.readContract({
      address: MOCKS_TASK_MANAGER_ADDRESS,
      abi: [{ name: 'logOps', type: 'function', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' }],
      functionName: 'logOps',
    });
    assert.equal(logOps, true);
  });
});

describe('cofhe.mocks.deployMocks() output', () => {
  it('follows gasWarning and mocksDeployVerbosity from the config', async () => {
    const hre = await createHardhatRuntimeEnvironment(
      {
        solidity: { version: '0.8.28' },
        plugins: [cofhePlugin, hardhatViem],
        cofhe: { gasWarning: false, mocksDeployVerbosity: '' },
      },
      {},
      process.cwd()
    );
    const { cofhe } = await hre.network.connect();

    const consoleLog = mock.method(console, 'log', () => {});
    try {
      await cofhe.mocks.deployMocks();
      assert.equal(consoleLog.mock.callCount(), 0);
    } finally {
      consoleLog.mock.restore();
    }
  });
});
