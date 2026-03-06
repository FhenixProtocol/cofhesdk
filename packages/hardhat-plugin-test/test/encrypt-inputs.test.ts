import hre from 'hardhat';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { expect } from 'chai';
import { hardhat } from '@cofhe/sdk/chains';

describe('Encrypt Inputs Test', () => {
  it('Should encrypt inputs', async () => {
    const [signer] = await hre.ethers.getSigners();

    const client = await hre.cofhe.createClientWithBatteries(signer);

    const encrypted = await client.encryptInputs([Encryptable.uint32(7n)]).execute();

    // Add number to TestBed
    const testBed = await hre.cofhe.mocks.getTestBed();
    await testBed.setNumber(encrypted[0]);
    const ctHash = await testBed.numberHash();

    // Decrypt number from TestBed
    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(7n);
  });
  it('should encrypt inputs with configurable encryptDelay', async () => {
    const [signer] = await hre.ethers.getSigners();

    const delays = [0, [100, 200, 300, 400, 500] as [number, number, number, number, number]];
    for (const delay of delays) {
      const config = await hre.cofhe.createConfig({
        supportedChains: [hardhat],
        mocks: {
          encryptDelay: delay,
        },
      });

      const client: CofheClient = hre.cofhe.createClient(config);
      await hre.cofhe.connectWithHardhatSigner(client, signer);

      let completedSteps = 0;

      await client
        .encryptInputs([Encryptable.uint32(7n)])
        .onStep((step, context) => {
          if (context == null || context.isStart) return;
          const stepDelay = Array.isArray(delay) ? delay[completedSteps] : delay;
          expect(stepDelay).to.equal(context.mockSleep);
          completedSteps++;
        })
        .execute();
    }
  });
});
