import hre from 'hardhat';
import { expect } from 'chai';
import {
  TASK_COFHE_USE_FAUCET,
  TASK_COFHE_MOCKS_DEPLOY,
  ExistsAbi,
  TASK_MANAGER_ADDRESS,
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
} from './consts';

describe('Cofhe Hardhat Plugin', () => {
  describe('Localcofhe Faucet command', () => {
    it('checks that the faucet works', async () => {
      await hre.run(TASK_COFHE_USE_FAUCET);
    });
  });

  describe('Hardhat Mocks', () => {
    it('checks that the mocks are deployed', async () => {
      await hre.run(TASK_COFHE_MOCKS_DEPLOY);

      const taskManager = await hre.ethers.getContractAt(ExistsAbi, TASK_MANAGER_ADDRESS);
      const tmExists = await taskManager.exists();
      expect(tmExists).to.be.true;

      const aclAddress = await taskManager.acl();

      const acl = await hre.ethers.getContractAt(ExistsAbi, aclAddress);
      const aclExists = await acl.exists();
      expect(aclExists).to.be.true;

      const queryDecrypter = await hre.ethers.getContractAt(ExistsAbi, MOCKS_QUERY_DECRYPTER_ADDRESS);
      const qdExists = await queryDecrypter.exists();
      expect(qdExists).to.be.true;

      const zkVerifier = await hre.ethers.getContractAt(ExistsAbi, MOCKS_ZK_VERIFIER_ADDRESS);
      const zkVerifierExists = await zkVerifier.exists();
      expect(zkVerifierExists).to.be.true;
    });
  });
});
