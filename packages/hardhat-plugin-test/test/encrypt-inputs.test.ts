import hre from 'hardhat';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { expect } from 'chai';

describe('Encrypt Inputs Test', () => {
  it('Should encrypt inputs', async () => {
    const [signer] = await hre.ethers.getSigners();

    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const client = await hre.cofhesdk.createBatteriesIncludedCofhesdkClient(signer);

    const encrypted = await client.encryptInputs([Encryptable.uint32(7n)]).encrypt();

    // Add number to TestBed
    const testBed = await hre.cofhesdk.mocks.getTestBed();
    await testBed.setNumber(encrypted[0]);
    const ctHash = await testBed.numberHash();

    // Decrypt number from TestBed
    const unsealed = await client.decryptHandle(ctHash, FheTypes.Uint32).decrypt();

    expect(unsealed).to.be.equal(7n);
  });
});
