import hre from 'hardhat';
import { localcofhe } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { PermitUtils, type Permission } from '@cofhe/sdk/permits';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

const hostChainRpcUrl = process.env.LOCALCOFHE_HOST_CHAIN_RPC || 'http://127.0.0.1:42069';
const thresholdNetworkUrl = localcofhe.thresholdNetworkUrl;

function makeThresholdRequestBody(ctHash: bigint | string, permission: Permission) {
  return {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: localcofhe.id,
    permit: permission,
  };
}

const viemLocalcofheChain: Chain = {
  id: localcofhe.id,
  name: localcofhe.name,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [hostChainRpcUrl],
    },
  },
};

describe('Local Cofhe Integration Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any; // ethers contract instance
  let localcofheSigner: HardhatEthersSigner;

  before(async function () {
    // Skip if no private key is provided (for CI/CD)
    if (!process.env.LOCALCOFHE_PRIVATE_KEY) {
      this.skip();
    }

    // Create viem clients for Local Cofhe
    const account = privateKeyToAccount(process.env.LOCALCOFHE_PRIVATE_KEY as `0x${string}`);

    publicClient = createPublicClient({
      chain: viemLocalcofheChain,
      transport: http(hostChainRpcUrl),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemLocalcofheChain,
      transport: http(hostChainRpcUrl),
      account,
    }) as WalletClient;

    // Create CoFHE SDK config and client
    const config = createCofheConfig({
      supportedChains: [localcofhe],
    });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);
    await cofheClient.permits.createSelf({
      name: 'Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1000000000000,
    });

    // Create a signer for Local Cofhe
    const localcofheProvider = new hre.ethers.JsonRpcProvider(hostChainRpcUrl);
    localcofheSigner = new hre.ethers.Wallet(
      process.env.LOCALCOFHE_PRIVATE_KEY as `0x${string}`,
      localcofheProvider
    ) as unknown as HardhatEthersSigner;

    // Deploy test contract using ethers
    const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTestFactory.connect(localcofheSigner).deploy();
    await testContract.waitForDeployment();
  });

  it('Should encrypt -> store -> on-chain FHE op -> decryptForView -> on-chain FHE op -> decryptForTx -> publish -> verify', async function () {
    this.timeout(120000);

    // Skip if no private key is provided
    if (!process.env.LOCALCOFHE_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    const testValue = 101n;
    const valueToAdd = 7n;
    const secondValueToAdd = 11n;
    const expectedViewValue = testValue + valueToAdd;
    const expectedTxValue = expectedViewValue + secondValueToAdd;

    // Encrypt and store a value
    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const storeTx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await storeTx.wait();

    const encryptedAddend = await cofheClient.encryptInputs([Encryptable.uint32(valueToAdd)]).execute();

    const addTx = await testContract.connect(localcofheSigner).addValue(encryptedAddend[0]);
    await addTx.wait();

    // Get the hash from the contract after an on-chain FHE op rewrote the ciphertext handle.
    const ctHash = await testContract.getValueHash();

    // await new Promise((resolve) => setTimeout(resolve, 6000));
    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    // Verify the decrypted value matches
    expect(unsealedResult).to.be.equal(expectedViewValue);

    const encryptedSecondAddend = await cofheClient.encryptInputs([Encryptable.uint32(secondValueToAdd)]).execute();

    const secondAddTx = await testContract.connect(localcofheSigner).addValue(encryptedSecondAddend[0]);
    await secondAddTx.wait();

    const updatedCtHash = await testContract.getValueHash();

    // await new Promise((resolve) => setTimeout(resolve, 6000));
    const decryptResult = await cofheClient.decryptForTx(updatedCtHash).withPermit().execute();

    expect(decryptResult.ctHash).to.equal(updatedCtHash);
    expect(decryptResult.decryptedValue).to.equal(expectedTxValue);
    expect(decryptResult.signature).to.be.a('string');

    const publishTx = await testContract
      .connect(localcofheSigner)
      .publishDecryptResult(updatedCtHash, decryptResult.decryptedValue, decryptResult.signature);
    await publishTx.wait();

    const [publishedValue, isDecrypted] = await testContract.getDecryptResultSafe(updatedCtHash);

    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(expectedTxValue);
  });

  it('Should return a cached completed payload when requesting an already decrypted decryption again', async function () {
    this.timeout(120000);

    const testValue = 73n;
    const valueToAdd = 19n;
    const expectedValue = testValue + valueToAdd;

    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const storeTx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await storeTx.wait();

    const encryptedAddend = await cofheClient.encryptInputs([Encryptable.uint32(valueToAdd)]).execute();

    const addTx = await testContract.connect(localcofheSigner).addValue(encryptedAddend[0]);
    await addTx.wait();

    const ctHash = await testContract.getValueHash();

    const firstDecryptResult = await cofheClient.decryptForTx(ctHash).withPermit().execute();

    expect(firstDecryptResult.ctHash).to.equal(ctHash);
    expect(firstDecryptResult.decryptedValue).to.equal(expectedValue);

    const activePermit = cofheClient.permits.getActivePermit();
    expect(activePermit).to.not.equal(undefined);

    const secondSubmitResponse = await fetch(`${thresholdNetworkUrl}/v2/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(makeThresholdRequestBody(ctHash, PermitUtils.getPermission(activePermit!, true))),
    });

    expect(secondSubmitResponse.status).to.equal(200);

    const secondSubmitBody = (await secondSubmitResponse.json()) as {
      request_id?: string | null;
      decrypted?: number[];
      signature?: string;
      encryption_type?: number;
      error_message?: string | null;
      message?: string;
    };

    expect(secondSubmitBody.error_message ?? secondSubmitBody.message).to.equal(undefined);
    expect(secondSubmitBody.request_id).to.be.a('string').and.not.empty;
    expect(secondSubmitBody.decrypted).to.be.an('array').and.not.empty;
    expect(secondSubmitBody.signature).to.be.a('string').and.not.empty;
    expect(secondSubmitBody.encryption_type).to.equal(FheTypes.Uint32);
  });

  it('Should return a cached sealed payload when requesting an already decrypted view again', async function () {
    this.timeout(120000);

    const testValue = 41n;
    const valueToAdd = 9n;
    const expectedValue = testValue + valueToAdd;

    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const storeTx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await storeTx.wait();

    const encryptedAddend = await cofheClient.encryptInputs([Encryptable.uint32(valueToAdd)]).execute();

    const addTx = await testContract.connect(localcofheSigner).addValue(encryptedAddend[0]);
    await addTx.wait();

    const ctHash = await testContract.getValueHash();

    const firstViewResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(firstViewResult).to.equal(expectedValue);

    const activePermit = cofheClient.permits.getActivePermit();
    expect(activePermit).to.not.equal(undefined);

    const secondSubmitResponse = await fetch(`${thresholdNetworkUrl}/v2/sealoutput`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(makeThresholdRequestBody(ctHash, PermitUtils.getPermission(activePermit!, true))),
    });

    expect(secondSubmitResponse.status).to.equal(200);

    const secondSubmitBody = (await secondSubmitResponse.json()) as {
      request_id?: string | null;
      sealed_data?: number[];
      ephemeral_public_key?: number[];
      nonce?: number[];
      encryption_type?: number;
      error_message?: string | null;
      message?: string;
    };

    expect(secondSubmitBody.error_message ?? secondSubmitBody.message).to.equal(undefined);
    expect(secondSubmitBody.request_id).to.be.a('string').and.not.empty;
    expect(secondSubmitBody.sealed_data).to.be.an('array').and.not.empty;
    expect(secondSubmitBody.ephemeral_public_key).to.be.an('array').and.not.empty;
    expect(secondSubmitBody.nonce).to.be.an('array').and.not.empty;
    expect(secondSubmitBody.encryption_type).to.equal(FheTypes.Uint32);
  });
});
