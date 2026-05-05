import hre from 'hardhat';
import { FheTypes } from '@cofhe/sdk';
import { expect } from 'chai';
import SimpleTestArtifact from '../../setup/out/SimpleTest.sol/SimpleTest.json';

describe('Permit Unseal Test', () => {
  it('Permit should be used to unseal data', async () => {
    const [signer] = await hre.ethers.getSigners();

    const client = await hre.cofhe.createClientWithBatteries(signer);

    // Add number to SimpleTest
    const simpleTest = await new hre.ethers.ContractFactory(
      SimpleTestArtifact.abi,
      SimpleTestArtifact.bytecode.object,
      signer
    ).deploy();
    await simpleTest.waitForDeployment();
    await simpleTest.setValueTrivial(7);
    const ctHash = await simpleTest.getValueHash();

    // Decrypt number from SimpleTest
    const unsealed = await client.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealed).to.be.equal(7n);
  });
});
