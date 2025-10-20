import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_USE_FAUCET, TASK_COFHE_MOCKS_DEPLOY } from './consts';
import {
  MockACLArtifact,
  MockQueryDecrypterArtifact,
  MockTaskManagerArtifact,
  MockZkVerifierArtifact,
} from '@cofhe/hardhat-plugin';

describe('Cofhe Hardhat Plugin', () => {
  describe('Localcofhe Faucet command', () => {
    it('checks that the faucet works', async () => {
      await hre.run(TASK_COFHE_USE_FAUCET);
    });
  });

  describe('Hardhat Mocks', () => {
    it('checks that the mocks are deployed', async () => {
      await hre.run(TASK_COFHE_MOCKS_DEPLOY);

      const taskManager = await hre.ethers.getContractAt(
        MockTaskManagerArtifact.abi,
        MockTaskManagerArtifact.fixedAddress
      );
      const tmExists = await taskManager.exists();
      expect(tmExists).to.be.true;

      const acl = await hre.ethers.getContractAt(MockACLArtifact.abi, MockACLArtifact.fixedAddress);
      const aclExists = await acl.exists();
      expect(aclExists).to.be.true;

      const queryDecrypter = await hre.ethers.getContractAt(
        MockQueryDecrypterArtifact.abi,
        MockQueryDecrypterArtifact.fixedAddress
      );
      const qdExists = await queryDecrypter.exists();
      expect(qdExists).to.be.true;

      const zkVerifier = await hre.ethers.getContractAt(
        MockZkVerifierArtifact.abi,
        MockZkVerifierArtifact.fixedAddress
      );
      const zkVerifierExists = await zkVerifier.exists();
      expect(zkVerifierExists).to.be.true;
    });
  });
});
