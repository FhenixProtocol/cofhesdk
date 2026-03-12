import hre from 'hardhat';
import { lineaSepolia } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { lineaSepolia as viemLineaSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

// Test private key - should be funded on Linea Sepolia
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PRIVATE_KEY =
  process.env.TEST_PRIVATE_KEY ||
  DEFAULT_TEST_PRIVATE_KEY; /* This key is publicly known and should only be used for testing with testnet ETH. Do not use this key on mainnet or with real funds. */

const deployments: Record<number, { address: string }> = {
  [lineaSepolia.id]: {
    address: '', // Set after first deploy or use env LINEA_SEPOLIA_SIMPLE_TEST_ADDRESS
  },
};

describe('Linea Sepolia Integration Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any; // ethers contract instance
  let lineaSepoliaSigner: HardhatEthersSigner;

  before(async function () {
    // Skip if no private key is provided (for CI/CD)
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    // Create viem clients for Linea Sepolia
    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

    console.log(`Using account address: ${account.address}`);

    const rpcUrl = process.env.LINEA_SEPOLIA_RPC_URL || 'https://rpc.sepolia.linea.build';

    publicClient = createPublicClient({
      chain: viemLineaSepolia,
      transport: http(rpcUrl),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemLineaSepolia,
      transport: http(rpcUrl),
      account,
    }) as WalletClient;

    // Create CoFHE SDK config and client
    const config = createCofheConfig({
      supportedChains: [lineaSepolia],
    });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);
    await cofheClient.permits.createSelf({
      name: 'Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1000000000000,
    });

    // Create a signer for Linea Sepolia
    const lineaSepoliaProvider = new hre.ethers.JsonRpcProvider(rpcUrl);
    lineaSepoliaSigner = new hre.ethers.Wallet(
      TEST_PRIVATE_KEY,
      lineaSepoliaProvider
    ) as unknown as HardhatEthersSigner;

    const deployedAddress = process.env.LINEA_SEPOLIA_SIMPLE_TEST_ADDRESS || deployments[lineaSepolia.id]?.address;

    if (deployedAddress) {
      testContract = await hre.ethers.getContractAt('SimpleTest', deployedAddress, lineaSepoliaSigner);
      deployments[lineaSepolia.id] = { address: deployedAddress };
      console.log(`Test contract already deployed at: ${deployedAddress}`);
    } else {
      console.log('Deploying test contract...');
      console.log('lineaSepoliaSigner', lineaSepoliaSigner.address);
      // Deploy test contract using ethers
      const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
      testContract = await SimpleTestFactory.connect(lineaSepoliaSigner).deploy();
      await testContract.waitForDeployment();
      const testContractAddress = await testContract.getAddress();
      deployments[lineaSepolia.id] = { address: testContractAddress };
      console.log(`Test contract deployed at: ${testContractAddress}`);
    }
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    // Skip if no private key is provided
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const testValue = 100n;

    // Encrypt and store a value
    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const tx = await testContract.connect(lineaSepoliaSigner).setValue(encrypted[0]);
    await tx.wait();

    // Get the hash from the contract (using the new getValueHash function)
    const ctHash = await testContract.getValueHash();

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    // Verify the decrypted value matches
    expect(unsealedResult).to.be.equal(testValue);

    // Decrypt for tx
    const decryptForTxResult = await cofheClient.decryptForTx(ctHash).withPermit().execute();

    console.log('decryptForTxResult', decryptForTxResult);

    expect(decryptForTxResult.ctHash).to.be.equal(ctHash);
    expect(decryptForTxResult.decryptedValue).to.be.equal(testValue);
    expect(decryptForTxResult.signature).to.be.a('string').and.have.lengthOf.above(0);
  });
});
