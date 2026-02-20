import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  TEST_BED_ADDRESS,
} from '@cofhe/sdk';

describe('Deploy Mocks Task', () => {
  it('should deploy mock contracts', async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    // TASK MANAGER

    const taskManagerFromCofhesdk = await hre.cofhesdk.mocks.getMockTaskManager();
    expect(await taskManagerFromCofhesdk.exists()).to.be.true;
    expect(await taskManagerFromCofhesdk.getAddress()).to.be.equal(TASK_MANAGER_ADDRESS);

    // ACL

    const aclFromCofhesdk = await hre.cofhesdk.mocks.getMockACL();
    const eip712domain = await aclFromCofhesdk.eip712Domain();
    const [fields, name, version, chainId, verifyingContract] = eip712domain;
    expect(name).to.equal('ACL');
    expect(version).to.equal('1');

    expect(await aclFromCofhesdk.exists()).to.be.true;
    expect(await aclFromCofhesdk.getAddress()).to.be.equal(await taskManagerFromCofhesdk.acl());

    // ZK VERIFIER

    const zkVerifierFromCofhesdk = await hre.cofhesdk.mocks.getMockZkVerifier();
    expect(await zkVerifierFromCofhesdk.exists()).to.be.true;
    expect(await zkVerifierFromCofhesdk.getAddress()).to.be.equal(MOCKS_ZK_VERIFIER_ADDRESS);

    // QUERY DECRYPTER

    const queryDecrypterFromCofhesdk = await hre.cofhesdk.mocks.getMockQueryDecrypter();
    expect(await queryDecrypterFromCofhesdk.exists()).to.be.true;
    expect(await queryDecrypterFromCofhesdk.getAddress()).to.be.equal(MOCKS_QUERY_DECRYPTER_ADDRESS);

    // TEST BED

    const testBedFromCofhesdk = await hre.cofhesdk.mocks.getTestBed();
    expect(await testBedFromCofhesdk.getAddress()).to.be.equal(TEST_BED_ADDRESS);
  });
});
