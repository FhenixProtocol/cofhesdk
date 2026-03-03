import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { CofheClient, Encryptable, MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY } from '@cofhe/sdk';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Wallet } from 'ethers';

// Test the full workflow:
// 1. Encrypt values and submit on-chain
// 2. Perform FHE operation (add)
// 3. Use decryptForTx to get ctHash, decryptedValue, and signature
// 4. Call publishDecryptResult with those values
// 5. Verify with getDecryptResultSafe

describe('Hardhat Mocks – Decrypt With Proof', () => {
  let cofheClient: CofheClient;
  let testContract: any;
  let signer: HardhatEthersSigner;
  let testBed: any;
  let taskManager: any;

  before(async function () {
    // Hardhat plugin auto-deploys mocks on TASK_TEST, but we need them deployed before creating the client, so we call the deploy task manually here.
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });
    const [tmpSigner] = await hre.ethers.getSigners();
    signer = tmpSigner;
    cofheClient = await hre.cofhe.createClientWithBatteries(signer);

    // Deploy test contract for FHE operations
    const SimpleTest = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTest.deploy();
    await testContract.waitForDeployment();

    testBed = await hre.cofhe.mocks.getTestBed();

    // Configure the mock task manager to accept the mock signature for all tests.
    taskManager = await hre.cofhe.mocks.getMockTaskManager();
    const messageSigner = new Wallet(MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY);
    const setSignerTx = await taskManager.connect(signer).setDecryptResultSigner(messageSigner.address);
    await setSignerTx.wait();
  });

  it('Should decrypt and publish result (publicAllowed, without permit)', async function () {
    const testValue = 123n;

    const [enc] = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    // Make this ciphertext globally decryptable
    const tx = await testContract.connect(signer).setPublicValue(enc);
    await tx.wait();

    const decryptResult = await cofheClient.decryptForTx(enc.ctHash).withoutPermit().execute();

    expect(decryptResult.ctHash).to.equal(enc.ctHash);
    expect(decryptResult.decryptedValue).to.equal(testValue);
    expect(decryptResult.signature).to.be.a('string');

    const ctHashBytes32 = hre.ethers.toBeHex(decryptResult.ctHash, 32);
    const signature = `0x${decryptResult.signature}`;
    const publishTx = await testBed.publishDecryptResult(ctHashBytes32, decryptResult.decryptedValue, signature);
    await publishTx.wait();

    const [publishedValue, isDecrypted] = await testBed.getDecryptResultSafe(ctHashBytes32);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(testValue);
  });

  it('Should encrypt, compute FHE operation, decrypt, and publish result (sender-only, with permit)', async function () {
    // Step 1: Encrypt two values
    const valueX = 100n;
    const valueY = 50n;
    const expectedSum = valueX + valueY; // 150

    const [encX, encY] = await cofheClient
      .encryptInputs([Encryptable.uint32(valueX), Encryptable.uint32(valueY)])
      .execute();

    // Step 2: Submit encrypted values on-chain and perform FHE.add
    const tx1 = await testContract.connect(signer).setValue(encX);
    await tx1.wait();

    const tx2 = await testContract.connect(signer).addValue(encY);
    await tx2.wait();

    const resultCtHash = await testContract.getValue();

    // Step 3: Use decryptForTx to get the values needed for publishDecryptResult
    const decryptResult = await cofheClient.decryptForTx(resultCtHash).withPermit().execute();

    expect(decryptResult.ctHash).to.equal(resultCtHash);
    expect(decryptResult.decryptedValue).to.equal(expectedSum);
    expect(decryptResult.signature).to.be.a('string');

    // Step 4: Publish the decrypt result on-chain
    const signature = `0x${decryptResult.signature}`;
    // Publish the decrypt result on-chain
    // publishDecryptResult expects (euint32, uint32, bytes signature)
    const publishTx = await testBed.publishDecryptResult(decryptResult.ctHash, decryptResult.decryptedValue, signature);
    await publishTx.wait();

    // Step 5: Verify the published result
    const [publishedValue, isDecrypted] = await testBed.getDecryptResultSafe(decryptResult.ctHash);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(expectedSum);
  });
});
