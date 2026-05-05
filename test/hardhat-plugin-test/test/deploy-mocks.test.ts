import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_MANAGER_ADDRESS, MOCKS_ZK_VERIFIER_ADDRESS, MOCKS_THRESHOLD_NETWORK_ADDRESS } from '@cofhe/sdk';
import SimpleTestArtifact from '../../setup/out/SimpleTest.sol/SimpleTest.json';

describe('Deploy Mocks Task', () => {
  it('should deploy mock contracts', async () => {
    // TASK MANAGER

    const taskManagerFromCofhesdk = await hre.cofhe.mocks.getMockTaskManager();
    expect(await taskManagerFromCofhesdk.exists()).to.be.true;
    expect(await taskManagerFromCofhesdk.getAddress()).to.be.equal(TASK_MANAGER_ADDRESS);

    // ACL

    const aclFromCofhesdk = await hre.cofhe.mocks.getMockACL();
    const eip712domain = await aclFromCofhesdk.eip712Domain();
    const [fields, name, version, chainId, verifyingContract] = eip712domain;
    expect(name).to.equal('ACL');
    expect(version).to.equal('1');

    expect(await aclFromCofhesdk.exists()).to.be.true;
    expect(await aclFromCofhesdk.getAddress()).to.be.equal(await taskManagerFromCofhesdk.acl());

    // ZK VERIFIER

    const zkVerifierFromCofhesdk = await hre.cofhe.mocks.getMockZkVerifier();
    expect(await zkVerifierFromCofhesdk.exists()).to.be.true;
    expect(await zkVerifierFromCofhesdk.getAddress()).to.be.equal(MOCKS_ZK_VERIFIER_ADDRESS);

    // THRESHOLD NETWORK

    const thresholdNetworkFromCofhesdk = await hre.cofhe.mocks.getMockThresholdNetwork();
    expect(await thresholdNetworkFromCofhesdk.exists()).to.be.true;
    expect(await thresholdNetworkFromCofhesdk.getAddress()).to.be.equal(MOCKS_THRESHOLD_NETWORK_ADDRESS);

    const [signer] = await hre.ethers.getSigners();
    const simpleTestFactory = new hre.ethers.ContractFactory(
      SimpleTestArtifact.abi,
      SimpleTestArtifact.bytecode.object,
      signer
    );
    const simpleTest = await simpleTestFactory.deploy();
    await simpleTest.waitForDeployment();

    expect(await simpleTest.getAddress()).to.properAddress;
    expect(await hre.ethers.provider.getCode(await simpleTest.getAddress())).to.not.equal('0x');
  });
});
