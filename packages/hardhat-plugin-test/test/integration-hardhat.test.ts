import hre from 'hardhat';
import { CofhesdkClient, Encryptable, FheTypes, type EncryptedItemInput } from '@cofhe/sdk';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Hardhat Integration Tests', () => {
  let cofhesdkClient: CofhesdkClient;
  let testContract: any; // ethers contract instance
  let signer: HardhatEthersSigner;

  before(async function () {
    // Deploy mocks first (required for Hardhat)
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    // Get a signer
    const [tmpSigner] = await hre.ethers.getSigners();
    signer = tmpSigner;

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
    const encryptedResult = await cofhesdkClient.encryptInputs([Encryptable.uint32(testValue)]).encrypt();
    const encrypted = (await hre.cofhesdk.expectResultSuccess(encryptedResult)) as [EncryptedItemInput];

    const tx = await testContract.connect(signer).setValue(encrypted[0]);
    await tx.wait();

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofhesdkClient.decryptHandle(encrypted[0].ctHash, FheTypes.Uint32).decrypt();

    // Verify the decrypted value matches
    await hre.cofhesdk.expectResultValue(unsealedResult, testValue);
  });
});
