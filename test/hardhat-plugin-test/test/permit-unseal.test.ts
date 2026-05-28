import hre from 'hardhat';
import { FheTypes } from '@cofhe/sdk';
import { expect } from 'chai';
import type { SharedSimpleTest } from '../typechain-types/contracts/SharedSimpleTest';

async function deploySharedSimpleTest(): Promise<SharedSimpleTest> {
  const factory = await hre.ethers.getContractFactory('SharedSimpleTest');
  const simpleTest = (await factory.deploy()) as SharedSimpleTest;
  await simpleTest.waitForDeployment();
  return simpleTest;
}

describe('Permit Unseal Test', () => {
  it('Permit should be used to unseal data', async () => {
    const [signer] = await hre.ethers.getSigners();

    const client = await hre.cofhe.createClientWithBatteries(signer);

    // Add number to SimpleTest
    const simpleTest = await deploySharedSimpleTest();
    await simpleTest.setValueTrivial(7);
    const ctHash = await simpleTest.getValueHash();

    // Decrypt number from SimpleTest
    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(7n);
  });
});
