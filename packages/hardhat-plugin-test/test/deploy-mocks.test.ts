import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import {
  MockQueryDecrypterArtifact,
  MockTaskManagerArtifact,
  MockZkVerifierArtifact,
  TestBedArtifact,
} from '@cofhe/hardhat-plugin';

describe('Deploy Mocks Task', () => {
  it('should deploy mock contracts', async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    // TASK MANAGER

    const taskManager = await hre.ethers.getContractAt(
      MockTaskManagerArtifact.abi,
      MockTaskManagerArtifact.fixedAddress
    );
    expect(await taskManager.exists()).to.be.true;

    const taskManagerFromCofhesdk = await hre.cofhesdk.mocks.getMockTaskManager();
    expect(await taskManagerFromCofhesdk.exists()).to.be.true;
    expect(await taskManagerFromCofhesdk.getAddress()).to.be.equal(MockTaskManagerArtifact.fixedAddress);

    // ACL

    const aclFromCofhesdk = await hre.cofhesdk.mocks.getMockACL();
    const eip712domain = await aclFromCofhesdk.eip712Domain();
    const [fields, name, version, chainId, verifyingContract] = eip712domain;
    expect(name).to.equal('ACL');
    expect(version).to.equal('1');

    expect(await aclFromCofhesdk.exists()).to.be.true;
    expect(await aclFromCofhesdk.getAddress()).to.be.equal(await taskManager.acl());

    // ZK VERIFIER

    const zkVerifier = await hre.ethers.getContractAt(MockZkVerifierArtifact.abi, MockZkVerifierArtifact.fixedAddress);
    expect(await zkVerifier.exists()).to.be.true;

    const zkVerifierFromCofhesdk = await hre.cofhesdk.mocks.getMockZkVerifier();
    expect(await zkVerifierFromCofhesdk.exists()).to.be.true;
    expect(await zkVerifierFromCofhesdk.getAddress()).to.be.equal(MockZkVerifierArtifact.fixedAddress);

    // QUERY DECRYPTER

    const queryDecrypter = await hre.ethers.getContractAt(
      MockQueryDecrypterArtifact.abi,
      MockQueryDecrypterArtifact.fixedAddress
    );
    expect(await queryDecrypter.exists()).to.be.true;

    const queryDecrypterFromCofhesdk = await hre.cofhesdk.mocks.getMockQueryDecrypter();
    expect(await queryDecrypterFromCofhesdk.exists()).to.be.true;
    expect(await queryDecrypterFromCofhesdk.getAddress()).to.be.equal(MockQueryDecrypterArtifact.fixedAddress);

    // TEST BED

    const testBedFromCofhesdk = await hre.cofhesdk.mocks.getTestBed();
    expect(await testBedFromCofhesdk.getAddress()).to.be.equal(TestBedArtifact.fixedAddress);
  });
});
