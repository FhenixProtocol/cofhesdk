import hre from 'hardhat';
import { localcofhe } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

const hostChainRpcUrl = process.env.LOCALCOFHE_HOST_CHAIN_RPC || 'http://127.0.0.1:42069';

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

  it('Should encrypt -> store -> on-chain FHE op -> decryptForView -> decryptForTx -> publish -> verify', async function () {
    // Skip if no private key is provided
    if (!process.env.LOCALCOFHE_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    const testValue = 101n;
    const valueToAdd = 7n;
    const expectedValue = testValue + valueToAdd;

    // Encrypt and store a value
    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const storeTx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await storeTx.wait();

    const encryptedAddend = await cofheClient.encryptInputs([Encryptable.uint32(valueToAdd)]).execute();

    const addTx = await testContract.connect(localcofheSigner).addValue(encryptedAddend[0]);
    await addTx.wait();

    // Get the hash from the contract after an on-chain FHE op rewrote the ciphertext handle.
    const ctHash = await testContract.getValueHash();

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    // Verify the decrypted value matches
    expect(unsealedResult).to.be.equal(expectedValue);

    const decryptResult = await cofheClient.decryptForTx(ctHash).withPermit().execute();

    expect(decryptResult.ctHash).to.equal(ctHash);
    expect(decryptResult.decryptedValue).to.equal(expectedValue);
    expect(decryptResult.signature).to.be.a('string');

    const publishTx = await testContract
      .connect(localcofheSigner)
      .publishDecryptResult(ctHash, decryptResult.decryptedValue, decryptResult.signature);
    await publishTx.wait();

    const [publishedValue, isDecrypted] = await testContract.getDecryptResultSafe(ctHash);

    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(expectedValue);
  });
});
