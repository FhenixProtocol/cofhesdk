import hre from 'hardhat';
import { CofheClient, CofheErrorCode, Encryptable, FheTypes } from '@cofhe/sdk';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { PermitUtils } from '@cofhe/sdk/permits';
import { hardhat } from '@cofhe/sdk/chains';
import { MockTaskManager, SimpleTest } from '../typechain-types';

describe('Hardhat Mocks – decryptForTx', () => {
  let cofheClient: CofheClient;
  let taskManager: MockTaskManager;
  let testContract: SimpleTest;
  let signer: HardhatEthersSigner;

  before(async function () {
    const [tmpSigner] = await hre.ethers.getSigners();
    signer = tmpSigner;
    cofheClient = await hre.cofhe.createClientWithBatteries(signer);
    taskManager = await hre.cofhe.mocks.getMockTaskManager();

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

      const storedValue = await testContract.storedValue();

      try {
        await cofheClient.decryptForTx(storedValue).withoutPermit().execute();
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

      const publicValue = await testContract.publicValue();
      const result = await cofheClient.decryptForTx(publicValue).withoutPermit().execute();

      expect(result.ctHash).to.be.equal(publicValue);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
      expect(result.signature).to.match(/^0x[0-9a-fA-F]+$/);
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

        const storedValue = await testContract.storedValue();

        const result = await cofheClient.decryptForTx(storedValue).withPermit(permit).execute();
        expect(result.ctHash).to.be.equal(storedValue);
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

      const storedValue = await testContract.storedValue();

      const result = await cofheClient.decryptForTx(storedValue).withPermit(permit).execute();

      expect(result.ctHash).to.be.equal(storedValue);
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

      const storedValue = await testContract.storedValue();

      const result = await cofheClient.decryptForTx(storedValue).withPermit().execute();

      expect(result.ctHash).to.be.equal(storedValue);
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
        const storedValue = await testContract.storedValue();
        await clientWithoutPermit.decryptForTx(storedValue).withPermit().execute();
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
        await clientWithoutPermit
          .decryptForTx('0x0000000000000000000000000000000000000000')
          .withPermit(missingHash)
          .execute();
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

      const storedValue = await testContract.storedValue();

      const result = await cofheClient.decryptForTx(storedValue).setAccount(signer.address).withPermit().execute();

      expect(result.ctHash).to.be.equal(storedValue);
      expect(result.decryptedValue).to.be.equal(testValue);
      expect(result.signature).to.be.a('string');
    });

    it('Should maintain builder state across multiple calls', async function () {
      const testValue = 22n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const storedValue = await testContract.storedValue();

      const builder = cofheClient.decryptForTx(storedValue).setAccount(signer.address).withPermit();

      const result1 = await builder.execute();
      expect(result1.ctHash).to.be.equal(storedValue);
      expect(result1.decryptedValue).to.be.equal(testValue);

      const result2 = await builder.execute();
      expect(result2.ctHash).to.be.equal(storedValue);
      expect(result2.decryptedValue).to.be.equal(testValue);
    });
  });

  describe('error cases', () => {
    // Error handling tests - can be extended as needed
  });

  describe('verify decrypt result', () => {
    it('Should verify decrypt result', async function () {
      const testValue = 100n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const storedValue = await testContract.storedValue();
      const decryptResult = await cofheClient.decryptForTx(storedValue).withPermit().execute();

      const isValid = await cofheClient.verifyDecryptResult(decryptResult.ctHash, testValue, decryptResult.signature);
      expect(isValid).to.be.true;
    });

    it('Should return false for invalid inputs', async function () {
      const testValue = 101n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const storedValue = await testContract.storedValue();
      const decryptResult = await cofheClient.decryptForTx(storedValue).withPermit().execute();

      expect(
        await cofheClient.verifyDecryptResult(decryptResult.ctHash, testValue + 1n, decryptResult.signature)
      ).to.equal(false);

      const tamperedSignature: `0x${string}` = `${decryptResult.signature}00`;
      expect(await cofheClient.verifyDecryptResult(decryptResult.ctHash, testValue, tamperedSignature)).to.equal(false);

      const wrongHandle = BigInt(decryptResult.ctHash) + 1n;
      expect(await cofheClient.verifyDecryptResult(wrongHandle, testValue, decryptResult.signature)).to.equal(false);
    });

    it('Should match MockTaskManager verification for the same inputs', async function () {
      const testValue = 202n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const storedValue = await testContract.storedValue();
      const decryptResult = await cofheClient.decryptForTx(storedValue).withPermit().execute();
      const tamperedSignature: `0x${string}` = `${decryptResult.signature}00`;

      const samples = [
        { handle: decryptResult.ctHash, cleartext: testValue, signature: decryptResult.signature },
        { handle: decryptResult.ctHash, cleartext: testValue + 1n, signature: decryptResult.signature },
        { handle: BigInt(decryptResult.ctHash) + 1n, cleartext: testValue, signature: decryptResult.signature },
        { handle: decryptResult.ctHash, cleartext: testValue, signature: tamperedSignature },
      ] as const;

      for (const sample of samples) {
        const sdkResult = await cofheClient.verifyDecryptResult(sample.handle, sample.cleartext, sample.signature);
        const contractResult = await taskManager.verifyDecryptResultSafe(
          sample.handle,
          sample.cleartext,
          sample.signature
        );

        expect(sdkResult).to.equal(contractResult);
      }
    });
  });

  describe('vs decryptForView', () => {
    it('Should return plaintext value', async function () {
      const testValue = 123n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const storedValue = await testContract.storedValue();

      const decryptForTxResult = await cofheClient.decryptForTx(storedValue).withPermit().execute();

      expect(decryptForTxResult.ctHash).to.be.equal(storedValue);
      expect(decryptForTxResult.decryptedValue).to.be.equal(testValue);
      expect(decryptForTxResult.signature).to.be.a('string');
    });

    it('Should support both decryptForView and decryptForTx', async function () {
      const testValue = 234n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const tx = await testContract.connect(signer).setValue(encrypted[0]);
      await tx.wait();

      const storedValue = await testContract.storedValue();

      const viewResult = await cofheClient.decryptForView(storedValue, FheTypes.Uint32).execute();
      const forTxResult = await cofheClient.decryptForTx(storedValue).withPermit().execute();

      expect(viewResult).to.be.equal(testValue);
      expect(forTxResult.ctHash).to.be.equal(storedValue);
      expect(forTxResult.decryptedValue).to.be.equal(testValue);
    });
  });
});
