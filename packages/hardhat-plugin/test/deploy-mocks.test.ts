import { describe, it, expect } from "vitest";
import { useEnvironment } from "./helpers";
import {
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  TASK_MANAGER_ADDRESS,
  TEST_BED_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
} from "../src/consts";
import { TASK_COFHE_MOCKS_DEPLOY } from "../src/consts";
import { HardhatRuntimeEnvironment } from "hardhat/types";

describe("Deploy Mocks Task", () => {
  const getTestBedBytecode = async (hre: HardhatRuntimeEnvironment) => {
    return await hre.ethers.provider.getCode(TEST_BED_ADDRESS);
  };

  const getHre = useEnvironment("hardhat");

  it("should deploy mock contracts", async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const taskManager = await hre.ethers.getContractAt(
      "TaskManager",
      TASK_MANAGER_ADDRESS,
    );
    expect(await taskManager.exists()).toBe(true);

    const acl = await hre.ethers.getContractAt("ACL", await taskManager.acl());
    expect(await acl.exists()).toBe(true);

    const zkVerifier = await hre.ethers.getContractAt(
      "MockZkVerifier",
      MOCKS_ZK_VERIFIER_ADDRESS,
    );
    expect(await zkVerifier.exists()).toBe(true);

    const queryDecrypter = await hre.ethers.getContractAt(
      "MockQueryDecrypter",
      MOCKS_QUERY_DECRYPTER_ADDRESS,
    );
    expect(await queryDecrypter.exists()).toBe(true);
  });

  it("should deploy mocks with test bed", async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, {
      deployTestBed: true,
    });

    // Verify contracts are deployed
    const taskManager = await hre.ethers.getContractAt(
      "TaskManager",
      TASK_MANAGER_ADDRESS,
    );
    expect(await taskManager.exists()).toBe(true);

    // Verify test bed is deployed
    const testBedBytecode = await getTestBedBytecode(hre);
    expect(testBedBytecode.length).toBeGreaterThan(2);

    const testBed = await hre.ethers.getContractAt("TestBed", TEST_BED_ADDRESS);
    expect(await testBed.exists()).toBe(true);
  });

  it("should deploy mocks without test bed", async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, {
      deployTestBed: false,
    });

    // Verify mock contracts are deployed
    const taskManager = await hre.ethers.getContractAt(
      "TaskManager",
      TASK_MANAGER_ADDRESS,
    );
    expect(await taskManager.exists()).toBe(true);

    // Verify test bed is not deployed
    const testBedBytecode = await getTestBedBytecode(hre);
    expect(testBedBytecode).toBe("0x");
  });
});
