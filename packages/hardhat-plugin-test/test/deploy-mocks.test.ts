import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import {
  MockACLArtifact,
  MockQueryDecrypterArtifact,
  MockTaskManagerArtifact,
  MockZkVerifierArtifact,
  TestBedArtifact,
} from '@cofhesdk/hardhat-plugin';

describe('Deploy Mocks Task', () => {
  const getTestBedBytecode = async (hre: HardhatRuntimeEnvironment) => {
    return await hre.ethers.provider.getCode(TestBedArtifact.fixedAddress);
  };

  it('should deploy mock contracts', async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const taskManager = await hre.ethers.getContractAt(
      MockTaskManagerArtifact.abi,
      MockTaskManagerArtifact.fixedAddress
    );
    expect(await taskManager.exists()).to.be.true;

    const acl = await hre.ethers.getContractAt(MockACLArtifact.abi, MockACLArtifact.fixedAddress);
    expect(await acl.exists()).to.be.true;

    const zkVerifier = await hre.ethers.getContractAt(MockZkVerifierArtifact.abi, MockZkVerifierArtifact.fixedAddress);
    expect(await zkVerifier.exists()).to.be.true;

    const queryDecrypter = await hre.ethers.getContractAt(
      MockQueryDecrypterArtifact.abi,
      MockQueryDecrypterArtifact.fixedAddress
    );
    expect(await queryDecrypter.exists()).to.be.true;
  });

  it('should deploy mocks with test bed', async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, {
      deployTestBed: true,
    });

    // Verify contracts are deployed
    const taskManager = await hre.ethers.getContractAt(
      MockTaskManagerArtifact.abi,
      MockTaskManagerArtifact.fixedAddress
    );
    expect(await taskManager.exists()).to.be.true;

    // Verify test bed is deployed
    const testBedBytecode = await getTestBedBytecode(hre);
    expect(testBedBytecode.length).to.be.greaterThan(2);

    const testBed = await hre.ethers.getContractAt(TestBedArtifact.abi, TestBedArtifact.fixedAddress);
    expect(await testBed.exists()).to.be.true;
  });
});
