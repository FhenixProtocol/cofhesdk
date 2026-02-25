import hre from 'hardhat';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { PermitUtils } from '@cofhe/sdk/permits';

describe('DecryptForTx Integration Tests', () => {
  let cofheClient: CofheClient;
  let testContract: any;
  let signer: HardhatEthersSigner;

  before(async function () {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);
    const [tmpSigner] = await hre.ethers.getSigners();
    signer = tmpSigner;
    cofheClient = await hre.cofhe.createClientWithBatteries(signer);

    const SimpleTest = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTest.deploy();
    await testContract.waitForDeployment();
    console.log(`Test contract deployed at: ${await testContract.getAddress()}`);
  });

  describe('decryptForTx with global allowance', () => {
    it('Should fail to decrypt without a permit when not globally allowed', async function () {
      const testValue = 42n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      try {
        await cofheClient.decryptForTx(encrypted[0].ctHash).withPermit(undefined).execute();
        expect.fail('Expected decryptForTx to fail without global allowance');
      } catch (error) {
        expect((error as Error).message).to.include('NotAllowed');
      }
    });

    it('Should successfully decrypt without a permit when globally allowed', async function () {
      const testValue = 55n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setPublicValue(encrypted[0]);
      await tx.wait();

      const result = await cofheClient.decryptForTx(encrypted[0].ctHash).withPermit(undefined).execute();

      expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });

    it('Should decrypt different values consistently with a permit', async function () {
      const testValues = [1n, 100n, 1000n, 65535n];
      const permit = await cofheClient.permits.createSelf({
        issuer: signer.address,
        name: 'Consistency Permit',
      });

      for (const testValue of testValues) {
        const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
        const tx = await testContract.connect(signer).setValue(encrypted[0]);
        await tx.wait();

        const result = await cofheClient.decryptForTx(encrypted[0].ctHash).withPermit(permit).execute();
        expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
        expect(result.decryptedValue).to.be.equal(testValue);
        expect(result.signature).to.be.a('string');
      }
    });
  });

  describe('decryptForTx with permit', () => {
    it('Should decrypt with a self permit', async function () {
      const testValue = 99n;
      const permit = await cofheClient.permits.createSelf({
        issuer: signer.address,
        name: 'Test Permit',
      });

      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const result = await cofheClient.decryptForTx(encrypted[0].ctHash).withPermit(permit).execute();

      expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });

    it('Should auto-resolve active permit', async function () {
      const testValue = 88n;
      const permit = await cofheClient.permits.createSelf({
        issuer: signer.address,
        name: 'Active Test Permit',
      });
      const permitHash = PermitUtils.getHash(permit);
      cofheClient.permits.selectActivePermit(permitHash);

      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const result = await cofheClient.decryptForTx(encrypted[0].ctHash).execute();

      expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });
  });

  describe('decryptForTx builder chain', () => {
    it('Should support builder chaining', async function () {
      const testValue = 33n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const result = await cofheClient.decryptForTx(encrypted[0].ctHash).setAccount(signer.address).execute();

      expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });

    it('Should maintain builder state across multiple calls', async function () {
      const testValue = 22n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const builder = cofheClient.decryptForTx(encrypted[0].ctHash).setAccount(signer.address);

      const result1 = await builder.execute();
      expect(result1.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result1.decryptedValue).to.be.equal(testValue);

      const result2 = await builder.execute();
      expect(result2.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result2.decryptedValue).to.be.equal(testValue);
    });
  });

  describe('decryptForTx error cases', () => {
    // Error handling tests - can be extended as needed
  });

  describe('decryptForTx vs decryptHandle', () => {
    it('Should return plaintext value', async function () {
      const testValue = 123n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const decryptForTxResult = await cofheClient.decryptForTx(encrypted[0].ctHash).execute();

      expect(decryptForTxResult.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(decryptForTxResult.decryptedValue).to.be.equal(testValue);
      expect(typeof decryptForTxResult.signature).to.equal('string');
    });

    it('Should support both decryptHandle and decryptForTx', async function () {
      const testValue = 234n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const ctHash = encrypted[0].ctHash;
      const handleResult = await cofheClient.decryptHandle(ctHash, FheTypes.Uint32).execute();
      const forTxResult = await cofheClient.decryptForTx(ctHash).execute();

      expect(handleResult).to.be.equal(testValue);
      expect(forTxResult.ctHash).to.be.equal(ctHash);
      expect(forTxResult.decryptedValue).to.be.equal(testValue);
    });
  });
});
