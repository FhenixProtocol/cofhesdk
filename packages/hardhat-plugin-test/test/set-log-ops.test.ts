import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY, TASK_COFHE_MOCKS_SET_LOG_OPS } from './consts';
import { Contract } from 'ethers';

describe('Set Log Ops Task', () => {
  let taskManager: Contract;

  beforeEach(async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    taskManager = await hre.cofhe.mocks.getMockTaskManager();

    await taskManager.setLogOps(false);
  });

  const expectLogOps = async (enabled: boolean) => {
    const logOps = await taskManager.logOps();
    console.log(`${enabled ? '├ ' : ''}(hh-test) Logging Enabled?`, logOps);
    expect(logOps).to.equal(enabled);
  };

  it('(task) should enable logging', async () => {
    // Verify initial state
    await expectLogOps(false);

    // Enable logging
    await hre.run(TASK_COFHE_MOCKS_SET_LOG_OPS, {
      enable: true,
    });

    expect(await taskManager.logOps()).to.be.true;
  });

  it('(function) should enable logging', async () => {
    // Verify initial state
    await expectLogOps(false);

    // Enable logging
    await hre.cofhe.mocks.enableLogs();

    await expectLogOps(true);

    await hre.cofhe.mocks.disableLogs();

    await expectLogOps(false);
  });

  it('(task) should disable logging', async () => {
    await hre.cofhe.mocks.enableLogs();
    await expectLogOps(true);

    // Disable logging
    await hre.run(TASK_COFHE_MOCKS_SET_LOG_OPS, {
      enable: false,
    });

    await expectLogOps(false);
  });

  it('(function) should disable logging', async () => {
    await hre.cofhe.mocks.enableLogs();

    await expectLogOps(true);

    // Disable logging
    await hre.cofhe.mocks.disableLogs();

    await expectLogOps(false);

    await hre.cofhe.mocks.enableLogs();

    await expectLogOps(true);
  });

  it('(function) mock_withLogs should enable logging', async () => {
    await expectLogOps(false);

    await hre.cofhe.mocks.withLogs("'hre.cofhe.mocks.withLogs' logging enabled?", async () => {
      // Verify logging is enabled inside the closure
      await expectLogOps(true);
    });

    // Verify logging is disabled outside of the closure
    await expectLogOps(false);
  });
});
