import hre from 'hardhat';
import { expect } from 'chai';
import SimpleTestArtifact from '../../setup/out/SimpleTest.sol/SimpleTest.json';

describe('Mocks Plaintext Test', () => {
  it('Should get plaintext from mocks', async () => {
    const [signer] = await hre.ethers.getSigners();
    const simpleTest = await new hre.ethers.ContractFactory(SimpleTestArtifact.abi, SimpleTestArtifact.bytecode.object, signer)
      .deploy();
    await simpleTest.waitForDeployment();
    await simpleTest.setValueTrivial(7);
    const ctHash = await simpleTest.getValueHash();

    const plaintextBytes32 = await hre.cofhe.mocks.getPlaintext(ctHash);
    expect(plaintextBytes32).to.be.equal(7n);
  });
  it('Should expect plaintext from mocks', async () => {
    const [signer] = await hre.ethers.getSigners();
    const simpleTest = await new hre.ethers.ContractFactory(SimpleTestArtifact.abi, SimpleTestArtifact.bytecode.object, signer)
      .deploy();
    await simpleTest.waitForDeployment();
    await simpleTest.setValueTrivial(7);
    const ctHash = await simpleTest.getValueHash();

    await hre.cofhe.mocks.expectPlaintext(ctHash, 7n);
  });
});
