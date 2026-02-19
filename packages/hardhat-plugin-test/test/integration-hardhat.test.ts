import hre from 'hardhat';
import { CofhesdkClient, Encryptable, FheTypes, type EncryptedItemInput } from '@cofhe/sdk';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { PermitUtils } from '@cofhe/sdk/permits';

describe('Hardhat Integration Tests', () => {
  let cofhesdkClient: CofhesdkClient;
  let testContract: any; // ethers contract instance
  let signer: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;

  before(async function () {
    // Deploy mocks first (required for Hardhat)
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    // Get a signer
    const [tmpSigner, tmpRecipient] = await hre.ethers.getSigners();
    signer = tmpSigner;
    recipient = tmpRecipient;

    // Create batteries-included client (handles Hardhat setup automatically)
    cofhesdkClient = await hre.cofhesdk.createBatteriesIncludedCofhesdkClient(signer);

    // Deploy test contract using ethers
    const SimpleTest = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTest.deploy();
    await testContract.waitForDeployment();
    const testContractAddress = await testContract.getAddress();

    console.log(`Test contract deployed at: ${testContractAddress}`);
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    const testValue = 100n;

    // Encrypt and store a value
    const encrypted = await cofhesdkClient.encryptInputs([Encryptable.uint32(testValue)]).encrypt();

    const tx = await testContract.connect(signer).setValue(encrypted[0]);
    await tx.wait();

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofhesdkClient.decryptHandle(encrypted[0].ctHash, FheTypes.Uint32).decrypt();

    // Verify the decrypted value matches
    expect(unsealedResult).to.be.equal(testValue);
  });

  it('Permit should be valid on chain', async function () {
    const permit = await cofhesdkClient.permits.createSelf({
      issuer: signer.address,
      name: 'Test Permit',
    });

    const isValid = await PermitUtils.checkValidityOnChain(permit, cofhesdkClient.getSnapshot().publicClient!);

    expect(isValid).to.be.true;
  });

  it('Expired permit should revert with PermissionInvalid_Expired', async function () {
    const permit = await cofhesdkClient.permits.createSelf({
      issuer: signer.address,
      name: 'Test Permit',
      expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    });

    try {
      await PermitUtils.checkValidityOnChain(permit, cofhesdkClient.getSnapshot().publicClient!);
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.be.equal('PermissionInvalid_Expired');
    }
  });

  it('Invalid issuer signature should revert with PermissionInvalid_IssuerSignature', async function () {
    const permit = await cofhesdkClient.permits.createSelf({
      issuer: signer.address,
      name: 'Test Permit',
    });

    permit.issuerSignature = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    try {
      await PermitUtils.checkValidityOnChain(permit, cofhesdkClient.getSnapshot().publicClient!);
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.be.equal('PermissionInvalid_IssuerSignature');
    }
  });
});
