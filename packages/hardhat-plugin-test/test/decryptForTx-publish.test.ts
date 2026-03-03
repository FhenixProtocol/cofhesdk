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
  });

  it('Should encrypt, compute FHE operation, decrypt, and publish result', async function () {
    // Ethers will normally perform an `eth_estimateGas` before sending a tx.
    // Providing an explicit gasLimit skips estimation (useful to avoid double-counting in gas reporter output).
    // To be extra explicit (and avoid any contract-wrapper behavior), we send raw transactions with encoded calldata.
    const gasLimit = 5_000_000n;

    // Step 1: Encrypt two values
    const valueX = 100n;
    const valueY = 50n;
    const expectedSum = valueX + valueY; // 150

    const [encX, encY] = await cofheClient
      .encryptInputs([Encryptable.uint32(valueX), Encryptable.uint32(valueY)])
      .execute();

    // Step 2: Submit encrypted values on-chain and perform FHE.add
    const simpleTestAddress = await testContract.getAddress();

    // Ensure we don't accidentally trigger gas estimation via the provider.
    // If `eth_estimateGas` happens here, it means our tx-sending path didn't actually skip estimation.
    const provider: any = hre.network.provider;
    const originalRequest: undefined | ((args: any) => Promise<any>) = provider.request?.bind(provider);
    let estimateGasCalls = 0;
    if (originalRequest) {
      provider.request = async (args: any) => {
        if (args?.method === 'eth_estimateGas') estimateGasCalls++;
        return originalRequest(args);
      };
    }

    try {
      const tx1 = await signer.sendTransaction({
        to: simpleTestAddress,
        data: testContract.interface.encodeFunctionData('setValue', [encX]),
        gasLimit,
      });
      await tx1.wait();

      const tx2 = await signer.sendTransaction({
        to: simpleTestAddress,
        data: testContract.interface.encodeFunctionData('addValue', [encY]),
        gasLimit,
      });
      await tx2.wait();

      expect(estimateGasCalls, 'eth_estimateGas should not be called when gasLimit is provided').to.equal(0);
    } finally {
      if (originalRequest) provider.request = originalRequest;
    }

    const resultCtHash = await testContract.getValue();

    // Step 3: Use decryptForTx to get the values needed for publishDecryptResult
    const decryptResult = await cofheClient.decryptForTx(resultCtHash).withPermit().execute();

    expect(decryptResult.ctHash).to.equal(resultCtHash);
    expect(decryptResult.decryptedValue).to.equal(expectedSum);
    expect(decryptResult.signature).to.be.a('string');

    // Step 4: Publish the decrypt result on-chain
    // Configure the mock task manager to accept the mock signature
    const taskManager = await hre.cofhe.mocks.getMockTaskManager();
    const messageSigner = new Wallet(MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY);
    const signature = `0x${decryptResult.signature}`;
    const taskManagerAddress = await taskManager.getAddress();
    const setSignerTx = await signer.sendTransaction({
      to: taskManagerAddress,
      data: taskManager.interface.encodeFunctionData('setDecryptResultSigner', [messageSigner.address]),
      gasLimit,
    });
    await setSignerTx.wait();

    // Publish the decrypt result on-chain
    // publishDecryptResult expects (euint32, uint32, bytes signature)
    const testBedAddress = await testBed.getAddress();
    const publishTx = await signer.sendTransaction({
      to: testBedAddress,
      data: testBed.interface.encodeFunctionData('publishDecryptResult', [
        decryptResult.ctHash,
        decryptResult.decryptedValue,
        signature,
      ]),
      gasLimit,
    });
    await publishTx.wait();

    // Step 5: Verify the published result
    const [publishedValue, isDecrypted] = await testBed.getDecryptResultSafe(decryptResult.ctHash);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(expectedSum);
  });
});
