import hre from 'hardhat';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { expect } from 'chai';
import { hardhat } from '@cofhe/sdk/chains';
import type { SharedSimpleTest } from '../typechain-types/contracts/SharedSimpleTest';

async function deploySharedSimpleTest(): Promise<SharedSimpleTest> {
  const factory = await hre.ethers.getContractFactory('SharedSimpleTest');
  const simpleTest = (await factory.deploy()) as SharedSimpleTest;
  await simpleTest.waitForDeployment();
  return simpleTest;
}

describe('Encrypt Inputs Test', () => {
  let simpleTest: SharedSimpleTest;
  before(async () => {
    simpleTest = await deploySharedSimpleTest();
  });

  it('Should encrypt inputs', async () => {
    const [signer] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(signer);

    const encrypted = await client.encryptInputs([Encryptable.uint32(7n)]).execute();

    // Add number to SimpleTest
    await simpleTest.setValue(encrypted[0]);
    const ctHash = await simpleTest.getValueHash();

    // Decrypt number from SimpleTest
    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(7n);
  });
  it('should encrypt inputs with hash plus proof', async () => {
    const [signer] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(signer);

    const [encHash, encProof] = await client
      .encryptInputs([Encryptable.uint32(7n)])
      .asHashPlusProof()
      .execute();

    expect(encHash).to.match(/^0x[0-9a-f]*$/i);
    expect(encProof).to.match(/^0x[0-9a-f]*$/i);

    // Add number to SimpleTest
    await simpleTest.setValueHashPlusProof(encHash, encProof);
    const ctHash = await simpleTest.getValueHash();

    // Decrypt number from SimpleTest
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
