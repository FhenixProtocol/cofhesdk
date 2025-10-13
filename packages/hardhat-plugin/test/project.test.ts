// tslint:disable-next-line no-implicit-dependencies
import { expect } from "chai";
import { TASK_COFHE_MOCKS_DEPLOY, TASK_COFHE_USE_FAUCET } from "../src/consts";
import { useEnvironment } from "./helpers";
import {
  QUERY_DECRYPTER_ADDRESS,
  TASK_MANAGER_ADDRESS,
  ZK_VERIFIER_ADDRESS,
} from "../src/addresses";

describe("Cofhe Hardhat Plugin", function () {
  describe("Localcofhe Faucet command", async function () {
    useEnvironment("localcofhe");
    it("checks that the faucet works", async function () {
      await this.hre.run(TASK_COFHE_USE_FAUCET);
    });
  });

  describe("Hardhat Mocks", async () => {
    useEnvironment("hardhat");
    it("checks that the mocks are deployed", async function () {
      await this.hre.run(TASK_COFHE_MOCKS_DEPLOY);

      const taskManager = await this.hre.ethers.getContractAt(
        "TaskManager",
        TASK_MANAGER_ADDRESS,
      );
      const tmExists = await taskManager.exists();
      expect(tmExists).to.equal(true);

      const aclAddress = await taskManager.acl();

      const acl = await this.hre.ethers.getContractAt("ACL", aclAddress);
      const aclExists = await acl.exists();
      expect(aclExists).to.equal(true);

      const queryDecrypter = await this.hre.ethers.getContractAt(
        "MockQueryDecrypter",
        QUERY_DECRYPTER_ADDRESS,
      );
      const qdExists = await queryDecrypter.exists();
      expect(qdExists).to.equal(true);

      const zkVerifier = await this.hre.ethers.getContractAt(
        "MockZkVerifier",
        ZK_VERIFIER_ADDRESS,
      );
      const zkVerifierExists = await zkVerifier.exists();
      expect(zkVerifierExists).to.equal(true);
    });
  });
});
