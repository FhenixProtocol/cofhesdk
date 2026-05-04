import hre from 'hardhat';
import { FheTypes } from '@cofhe/sdk';
import { expect } from 'chai';

describe('Permit Unseal Test', () => {
  it('Permit should be used to unseal data', async () => {
    const [signer] = await hre.ethers.getSigners();

    const client = await hre.cofhe.createClientWithBatteries(signer);

    // Add number to TestBed
    const testBed = await hre.cofhe.mocks.getTestBed();
    await testBed.setValueTrivial(7);
    const ctHash = await testBed.getValueHash();

    // Decrypt number from TestBed
    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(7n);
  });
});
