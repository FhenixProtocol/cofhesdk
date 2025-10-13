import { describe, it, expect, beforeEach } from "vitest";
import { useEnvironment } from "./helpers";
import { TASK_MANAGER_ADDRESS } from "../src/consts";
import {
  TASK_COFHE_MOCKS_DEPLOY,
  TASK_COFHE_MOCKS_SET_LOG_OPS,
} from "../src/consts";
import { mock_setLoggingEnabled, mock_withLogs } from "../src/mocksLogging";
import { Contract } from "ethers";

describe("Set Log Ops Task", () => {
  const getHre = useEnvironment("hardhat");
  let taskManager: Contract;

  beforeEach(async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    taskManager = await hre.ethers.getContractAt(
      "TaskManager",
      TASK_MANAGER_ADDRESS,
    );
  });

  const expectLogOps = async (enabled: boolean) => {
    const logOps = await taskManager.logOps();
    console.log(`${enabled ? "├ " : ""}(hh-test) Logging Enabled?`, logOps);
    expect(logOps).toBe(enabled);
  };

  it("(task) should enable logging", async () => {
    const hre = getHre();
    // Verify initial state
    await expectLogOps(false);

    // Enable logging
    await hre.run(TASK_COFHE_MOCKS_SET_LOG_OPS, {
      enable: true,
    });

    expect(await taskManager.logOps()).toBe(true);
  });

  it("(function) should enable logging", async () => {
    const hre = getHre();
    // Verify initial state
    await expectLogOps(false);

    // Enable logging
    await hre.cofhesdk.mocks.enableLogs();

    await expectLogOps(true);

    await hre.cofhesdk.mocks.disableLogs();

    // Disable logging (not hre)
    await mock_setLoggingEnabled(hre, false);

    await expectLogOps(false);
  });

  it("(task) should disable logging", async () => {
    const hre = getHre();
    await hre.cofhesdk.mocks.enableLogs();
    await expectLogOps(true);

    // Disable logging
    await hre.run(TASK_COFHE_MOCKS_SET_LOG_OPS, {
      enable: false,
    });

    await expectLogOps(false);
  });

  it("(function) should disable logging", async () => {
    const hre = getHre();
    await hre.cofhesdk.mocks.enableLogs();

    await expectLogOps(true);

    // Disable logging
    await hre.cofhesdk.mocks.disableLogs();

    await expectLogOps(false);

    await hre.cofhesdk.mocks.enableLogs();

    // Disable logging (not hre)
    await mock_setLoggingEnabled(hre, false);

    await expectLogOps(false);
  });

  it("(function) mock_withLogs should enable logging", async () => {
    const hre = getHre();
    await hre.cofhesdk.mocks.withLogs(
      "'hre.cofhesdk.mocks.withLogs' logging enabled?",
      async () => {
        // Verify logging is enabled inside the closure
        await expectLogOps(true);
      },
    );

    // Verify logging is disabled outside of the closure
    await expectLogOps(false);

    await mock_withLogs(hre, "'mock_withLogs' logging enabled?", async () => {
      // Verify logging is enabled inside the closure
      await expectLogOps(true);
    });

    // Verify logging is disabled outside of the closure
    await expectLogOps(false);
  });
});
