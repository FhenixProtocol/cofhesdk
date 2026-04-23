import hre from 'hardhat';
import { expect } from 'chai';
import { CofheClient, Encryptable } from '@cofhe/sdk';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MockTaskManager, TestBed } from '@cofhe/mock-contracts';

// Tests that exercise Hardhat mock-specific revert behavior for publishDecryptResult.
// The full decrypt lifecycle and SDK-level verifyDecryptResult are tested in
// packages/sdk/core/test/decrypt.test.ts against a real testnet.

describe('Hardhat Mocks – publishDecryptResult revert behavior', () => {
  let cofheClient: CofheClient;
  let testContract: any;
  let signer: HardhatEthersSigner;
  let testBed: TestBed;
  let taskManager: MockTaskManager;

  before(async function () {
    const [tmpSigner] = await hre.ethers.getSigners();
    signer = tmpSigner;
    cofheClient = await hre.cofhe.createClientWithBatteries(signer);

    const SimpleTest = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTest.deploy();
    await testContract.waitForDeployment();

    testBed = await hre.cofhe.mocks.getTestBed();
    taskManager = await hre.cofhe.mocks.getMockTaskManager();
  });

  it('should revert publishDecryptResult with incorrect value', async function () {
    const testValue = 123n;

    const [enc] = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const tx = await testContract.connect(signer).setPublicValue(enc);
    await tx.wait();

    const decryptResult = await cofheClient.decryptForTx(enc.ctHash).withoutPermit().execute();

    const ctHashBytes32 = hre.ethers.toBeHex(decryptResult.ctHash, 32);
    await expect(testBed.publishDecryptResult(ctHashBytes32, 0n, decryptResult.signature)).to.be.reverted;

    await expect(taskManager.verifyDecryptResult(ctHashBytes32, 0n, decryptResult.signature)).to.be.reverted;

    const validFalse = await taskManager.verifyDecryptResultSafe(ctHashBytes32, 0n, decryptResult.signature);
    expect(validFalse).to.be.false;

    const validTrue = await taskManager.verifyDecryptResultSafe(ctHashBytes32, testValue, decryptResult.signature);
    expect(validTrue).to.be.true;
  });
});
