import hre from 'hardhat';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { FheTypes } from '@cofhe/sdk';

describe('Permit Unseal Test', () => {
  it('Permit should be used to unseal data', async () => {
    const [signer] = await hre.ethers.getSigners();

    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const client = await hre.cofhesdk.createBatteriesIncludedCofhesdkClient(signer);

    // Add number to TestBed
    const testBed = await hre.cofhesdk.mocks.getTestBed();
    await testBed.setNumberTrivial(7);
    const ctHash = await testBed.numberHash();

    // Decrypt number from TestBed
    const unsealed = await client.decryptHandle(ctHash, FheTypes.Uint32).decrypt();

    await hre.cofhesdk.expectResultSuccess(unsealed);
    await hre.cofhesdk.expectResultValue(unsealed, 7n);
  });
});
