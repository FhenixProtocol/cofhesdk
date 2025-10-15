import { expect } from 'chai';
import { describe, it } from 'mocha';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { useEnvironment } from './helpers.js';
import {
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  TASK_MANAGER_ADDRESS,
  TEST_BED_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
} from '../src/consts.js';
import { TASK_COFHE_MOCKS_DEPLOY } from '../src/consts.js';

describe('Deploy Mocks Task', () => {
  const getTestBedBytecode = async (hre: HardhatRuntimeEnvironment) => {
    return await hre.ethers.provider.getCode(TEST_BED_ADDRESS);
  };

  const getHre = useEnvironment('hardhat');

  it('should deploy mock contracts', async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const taskManager = await hre.ethers.getContractAt('MockTaskManager', TASK_MANAGER_ADDRESS);
    expect(await taskManager.exists()).to.be.true;

    const acl = await hre.ethers.getContractAt('MockACL', await taskManager.acl());
    expect(await acl.exists()).to.be.true;

    const zkVerifier = await hre.ethers.getContractAt('MockZkVerifier', MOCKS_ZK_VERIFIER_ADDRESS);
    expect(await zkVerifier.exists()).to.be.true;

    const queryDecrypter = await hre.ethers.getContractAt('MockQueryDecrypter', MOCKS_QUERY_DECRYPTER_ADDRESS);
    expect(await queryDecrypter.exists()).to.be.true;
  });

  it('should deploy mocks with test bed', async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, {
      deployTestBed: true,
    });

    // Verify contracts are deployed
    const taskManager = await hre.ethers.getContractAt('MockTaskManager', TASK_MANAGER_ADDRESS);
    expect(await taskManager.exists()).to.be.true;

    // Verify test bed is deployed
    const testBedBytecode = await getTestBedBytecode(hre);
    expect(testBedBytecode.length).to.be.greaterThan(2);

    const testBed = await hre.ethers.getContractAt('TestBed', TEST_BED_ADDRESS);
    expect(await testBed.exists()).to.be.true;
  });

  it('should deploy mocks without test bed', async () => {
    const hre = getHre();
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, {
      deployTestBed: false,
    });

    // Verify mock contracts are deployed
    const taskManager = await hre.ethers.getContractAt('MockTaskManager', TASK_MANAGER_ADDRESS);
    expect(await taskManager.exists()).to.be.true;

    // Verify test bed is not deployed
    const testBedBytecode = await getTestBedBytecode(hre);
    expect(testBedBytecode).to.equal('0x');
  });
});
