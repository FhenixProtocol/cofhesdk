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

    // [hash, signature] - one hash per input, followed by the shared batch signature.
    const [encHash, encSignature] = await client
      .encryptInputs([Encryptable.uint32(7n)])
      .setConsumingContract(await simpleTest.getAddress())
      .execute();

    expect(encHash).to.match(/^0x[0-9a-f]*$/i);
    expect(encSignature).to.match(/^0x[0-9a-f]*$/i);

    // Add number to SimpleTest via the batch-verified entry point
    await simpleTest.setValueBatch([encHash], encSignature);
    const ctHash = await simpleTest.getValueHash();

    // Decrypt number from SimpleTest
    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(7n);
  });
  // Regression guard for the migration guide: contracts with a single encrypted parameter are
  // told they can keep their `(externalEuint32, bytes)` ABI. That holds only because
  // cofhe-contracts 0.2.x routes `FHE.asEuint32(hash, proof)` through `batchVerifyInputs` as a
  // one-element batch, so encryptInputs()'s batch-of-1 signature verifies through it unchanged.
  it('Should accept a batch-of-1 signature via a single-value entry point', async () => {
    const [signer] = await hre.ethers.getSigners();
    const client = await hre.cofhe.createClientWithBatteries(signer);

    const [encHash, encSignature] = await client
      .encryptInputs([Encryptable.uint32(11n)])
      .setConsumingContract(await simpleTest.getAddress())
      .execute();

    // setValue takes (externalEuint32, bytes) - not the *Batch entry point.
    await simpleTest.setValue(encHash, encSignature);
    const ctHash = await simpleTest.getValueHash();

    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(11n);
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
        .setConsumingContract(await simpleTest.getAddress())
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
