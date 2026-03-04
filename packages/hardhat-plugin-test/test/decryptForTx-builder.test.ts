import hre from 'hardhat';
import { CofheClient, CofheErrorCode, Encryptable, FheTypes } from '@cofhe/sdk';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { PermitUtils } from '@cofhe/sdk/permits';
import { hardhat } from '@cofhe/sdk/chains';

describe('Hardhat Mocks – decryptForTx', () => {
  let cofheClient: CofheClient;
  let testContract: any;
  let signer: HardhatEthersSigner;

  before(async function () {
    const [tmpSigner] = await hre.ethers.getSigners();
    signer = tmpSigner;
    cofheClient = await hre.cofhe.createClientWithBatteries(signer);

    const SimpleTest = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTest.deploy();
    await testContract.waitForDeployment();
    console.log(`Test contract deployed at: ${await testContract.getAddress()}`);
  });

  describe('global allowance (withoutPermit)', () => {
    it('Should fail to decrypt without a permit when not globally allowed', async function () {
      const testValue = 42n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      try {
        await cofheClient.decryptForTx(encrypted[0].ctHash).withoutPermit().execute();
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

      const result = await cofheClient.decryptForTx(encrypted[0].ctHash).withoutPermit().execute();

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

  describe('permit (withPermit)', () => {
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

      const result = await cofheClient.decryptForTx(encrypted[0].ctHash).withPermit().execute();

      expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });

    it('Should throw when withPermit() has no active permit', async function () {
      const [, otherSigner] = await hre.ethers.getSigners();

      const config = await hre.cofhe.createConfig({
        environment: 'hardhat',
        supportedChains: [hardhat],
      });

      const clientWithoutPermit = hre.cofhe.createClient(config);
      await hre.cofhe.connectWithHardhatSigner(clientWithoutPermit, otherSigner);

      try {
        await clientWithoutPermit.decryptForTx(0n).withPermit().execute();
        expect.fail('Expected decryptForTx to throw when no active permit exists');
      } catch (error) {
        const e = error as any;
        expect(e).to.have.property('code');
        expect(e.code).to.equal(CofheErrorCode.PermitNotFound);
        expect((e as Error).message).to.include('Active permit not found');
      }
    });

    it('Should throw when withPermit(hash) cannot find permit', async function () {
      const [, otherSigner] = await hre.ethers.getSigners();

      const config = await hre.cofhe.createConfig({
        environment: 'hardhat',
        supportedChains: [hardhat],
      });

      const clientWithoutPermit = hre.cofhe.createClient(config);
      await hre.cofhe.connectWithHardhatSigner(clientWithoutPermit, otherSigner);

      const missingHash = '0xdeadbeef';

      try {
        await clientWithoutPermit.decryptForTx(0n).withPermit(missingHash).execute();
        expect.fail('Expected decryptForTx to throw when permit hash does not exist');
      } catch (error) {
        const e = error as any;
        expect(e).to.have.property('code');
        expect(e.code).to.equal(CofheErrorCode.PermitNotFound);
        expect((e as Error).message).to.include('Permit with hash');
      }
    });
  });

  describe('builder chain', () => {
    it('Should support builder chaining', async function () {
      const testValue = 33n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const result = await cofheClient
        .decryptForTx(encrypted[0].ctHash)
        .setAccount(signer.address)
        .withPermit()
        .execute();

      expect(result.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });

    it('Should maintain builder state across multiple calls', async function () {
      const testValue = 22n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const builder = cofheClient.decryptForTx(encrypted[0].ctHash).setAccount(signer.address).withPermit();

      const result1 = await builder.execute();
      expect(result1.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result1.decryptedValue).to.be.equal(testValue);

      const result2 = await builder.execute();
      expect(result2.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(result2.decryptedValue).to.be.equal(testValue);
    });
  });

  describe('error cases', () => {
    // Error handling tests - can be extended as needed
  });

  describe('vs decryptForView', () => {
    it('Should return plaintext value', async function () {
      const testValue = 123n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const decryptForTxResult = await cofheClient.decryptForTx(encrypted[0].ctHash).withPermit().execute();

      expect(decryptForTxResult.ctHash).to.be.equal(encrypted[0].ctHash);
      expect(decryptForTxResult.decryptedValue).to.be.equal(testValue);
      expect(typeof decryptForTxResult.signature).to.equal('string');
    });

    it('Should support both decryptForView and decryptForTx', async function () {
      const testValue = 234n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const ctHash = encrypted[0].ctHash;
      const viewResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
      const forTxResult = await cofheClient.decryptForTx(ctHash).withPermit().execute();

      expect(viewResult).to.be.equal(testValue);
      expect(forTxResult.ctHash).to.be.equal(ctHash);
      expect(forTxResult.decryptedValue).to.be.equal(testValue);
    });
  });
});
