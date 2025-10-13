import { expect } from "chai";
import { useEnvironment } from "./helpers";
import { TASK_MANAGER_ADDRESS } from "../src/addresses";
import {
  TASK_COFHE_MOCKS_DEPLOY,
  TASK_COFHE_MOCKS_SET_LOG_OPS,
} from "../src/const";
import { mock_setLoggingEnabled, mock_withLogs } from "../src/mock-logs";
import { Contract } from "ethers";

describe("Set Log Ops Task", function () {
  useEnvironment("hardhat");

  let taskManager: Contract;

  beforeEach(async function () {
    await this.hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    taskManager = await this.hre.ethers.getContractAt(
      "TaskManager",
      TASK_MANAGER_ADDRESS,
    );
  });

  const expectLogOps = async (enabled: boolean) => {
    const logOps = await taskManager.logOps();
    console.log(`${enabled ? "├ " : ""}(hh-test) Logging Enabled?`, logOps);
    expect(logOps).to.equal(enabled);
  };

  it("(task) should enable logging", async function () {
    // Verify initial state
    await expectLogOps(false);

    // Enable logging
    await this.hre.run(TASK_COFHE_MOCKS_SET_LOG_OPS, {
      enable: true,
    });

    expect(await taskManager.logOps()).to.equal(true);
  });
  it("(function) should enable logging", async function () {
    // Verify initial state
    await expectLogOps(false);

    // Enable logging
    await this.hre.cofhe.mocks.enableLogs();

    await expectLogOps(true);

    await this.hre.cofhe.mocks.disableLogs();

    // Disable logging (not hre)
    await mock_setLoggingEnabled(this.hre, false);

    await expectLogOps(false);
  });

  it("(task) should disable logging", async function () {
    await this.hre.cofhe.mocks.enableLogs();
    await expectLogOps(true);

    // Disable logging
    await this.hre.run(TASK_COFHE_MOCKS_SET_LOG_OPS, {
      enable: false,
    });

    await expectLogOps(false);
  });
  it("(function) should disable logging", async function () {
    await this.hre.cofhe.mocks.enableLogs();

    await expectLogOps(true);

    // Disable logging
    await this.hre.cofhe.mocks.disableLogs();

    await expectLogOps(false);

    await this.hre.cofhe.mocks.enableLogs();

    // Disable logging (not hre)
    await mock_setLoggingEnabled(this.hre, false);

    await expectLogOps(false);
  });

  it("(function) mock_withLogs should enable logging", async function () {
    await this.hre.cofhe.mocks.withLogs(
      "'hre.cofhe.mocks.withLogs' logging enabled?",
      async () => {
        // Verify logging is enabled inside the closure
        await expectLogOps(true);
      },
    );

    // Verify logging is disabled outside of the closure
    await expectLogOps(false);

    await mock_withLogs(
      this.hre,
      "'mock_withLogs' logging enabled?",
      async () => {
        // Verify logging is enabled inside the closure
        await expectLogOps(true);
      },
    );

    // Verify logging is disabled outside of the closure
    await expectLogOps(false);
  });
});
