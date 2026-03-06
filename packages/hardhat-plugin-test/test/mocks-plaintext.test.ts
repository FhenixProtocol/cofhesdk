import hre from 'hardhat';
import { expect } from 'chai';

describe('Mocks Plaintext Test', () => {
  it('Should get plaintext from mocks', async () => {
    // Add number to TestBed
    const testBed = await hre.cofhe.mocks.getTestBed();
    await testBed.setNumberTrivial(7);
    const ctHash = await testBed.numberHash();

    const plaintextBytes32 = await hre.cofhe.mocks.getPlaintext(ctHash);
    expect(plaintextBytes32).to.be.equal(7n);

    const plaintextUint256 = BigInt(await hre.cofhe.mocks.getPlaintext(ctHash));
    expect(plaintextUint256).to.be.equal(7n);

    await hre.cofhe.mocks.expectPlaintext(ctHash, 7n);
    await hre.cofhe.mocks.expectPlaintext(BigInt(ctHash), 7n);
  });
});
