import { expect } from "chai";
import { describe, it } from "mocha";
import { TASK_COFHE_MOCKS_DEPLOY, TASK_COFHE_USE_FAUCET } from "../src/consts";
import { useEnvironment } from "./helpers";
import {
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
} from "../src/consts";

describe("Cofhe Hardhat Plugin", () => {
  describe("Localcofhe Faucet command", () => {
    const getHre = useEnvironment("localcofhe");

    it("checks that the faucet works", async () => {
      const hre = getHre();
      await hre.run(TASK_COFHE_USE_FAUCET);
    });
  });

  describe("Hardhat Mocks", () => {
    const getHre = useEnvironment("hardhat");

    it("checks that the mocks are deployed", async () => {
      const hre = getHre();
      await hre.run(TASK_COFHE_MOCKS_DEPLOY);

      const taskManager = await hre.ethers.getContractAt(
        "MockTaskManager",
        TASK_MANAGER_ADDRESS,
      );
      const tmExists = await taskManager.exists();
      expect(tmExists).to.be.true;

      const aclAddress = await taskManager.acl();

      const acl = await hre.ethers.getContractAt("MockACL", aclAddress);
      const aclExists = await acl.exists();
      expect(aclExists).to.be.true;

      const queryDecrypter = await hre.ethers.getContractAt(
        "MockQueryDecrypter",
        MOCKS_QUERY_DECRYPTER_ADDRESS,
      );
      const qdExists = await queryDecrypter.exists();
      expect(qdExists).to.be.true;

      const zkVerifier = await hre.ethers.getContractAt(
        "MockZkVerifier",
        MOCKS_ZK_VERIFIER_ADDRESS,
      );
      const zkVerifierExists = await zkVerifier.exists();
      expect(zkVerifierExists).to.be.true;
    });
  });
});
