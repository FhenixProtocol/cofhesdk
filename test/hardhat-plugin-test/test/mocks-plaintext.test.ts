import hre from 'hardhat';
import { expect } from 'chai';

describe('Mocks Plaintext Test', () => {
  it('Should get plaintext from mocks', async () => {
    const testBed = await hre.cofhe.mocks.getTestBed();
    await testBed.setValueTrivial(7);
    const ctHash = await testBed.getValueHash();

    const plaintextBytes32 = await hre.cofhe.mocks.getPlaintext(ctHash);
    expect(plaintextBytes32).to.be.equal(7n);
  });
  it('Should expect plaintext from mocks', async () => {
    const testBed = await hre.cofhe.mocks.getTestBed();
    await testBed.setValueTrivial(7);
    const ctHash = await testBed.getValueHash();

    await hre.cofhe.mocks.expectPlaintext(ctHash, 7n);
  });
});
