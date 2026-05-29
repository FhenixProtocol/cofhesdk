import hre from 'hardhat';
import { expect } from 'chai';
import type { SharedSimpleTest } from '../typechain-types/contracts/SharedSimpleTest';

async function deploySharedSimpleTest(): Promise<SharedSimpleTest> {
  const factory = await hre.ethers.getContractFactory('SharedSimpleTest');
  const simpleTest = (await factory.deploy()) as SharedSimpleTest;
  await simpleTest.waitForDeployment();
  return simpleTest;
}

describe('Mocks Plaintext Test', () => {
  it('Should get plaintext from mocks', async () => {
    const simpleTest = await deploySharedSimpleTest();
    await simpleTest.setValueTrivial(7);
    const ctHash = await simpleTest.getValueHash();

    const plaintextBytes32 = await hre.cofhe.mocks.getPlaintext(ctHash);
    expect(plaintextBytes32).to.be.equal(7n);
  });
  it('Should expect plaintext from mocks', async () => {
    const simpleTest = await deploySharedSimpleTest();
    await simpleTest.setValueTrivial(7);
    const ctHash = await simpleTest.getValueHash();

    await hre.cofhe.mocks.expectPlaintext(ctHash, 7n);
  });
});
