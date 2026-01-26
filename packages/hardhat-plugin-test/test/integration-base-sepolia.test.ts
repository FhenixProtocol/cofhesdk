import hre from 'hardhat';
import { baseSepolia } from '@cofhe/sdk/chains';
import { CofhesdkClient, Encryptable, FheTypes, type EncryptedItemInput } from '@cofhe/sdk';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { baseSepolia as viemBaseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofhesdkClient, createCofhesdkConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

// Test private key - should be funded on Base Sepolia
// Using a well-known test key, but you'll need to fund it with testnet ETH
const TEST_PRIVATE_KEY =
  process.env.TEST_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const deployments = {
  [baseSepolia.id]: {
    address: '0x50232BdA22A8bE7511655D430677EcF8e852C7B6',
  },
};

describe('Base Sepolia Integration Tests', () => {
  let cofhesdkClient: CofhesdkClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any; // ethers contract instance
  let baseSepoliaSigner: HardhatEthersSigner;

  before(async function () {
    // Skip if no private key is provided (for CI/CD)
    if (!process.env.BASE_SEPOLIA_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    // Create viem clients for Base Sepolia
    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

    console.log(`Using account address: ${account.address}`);

    publicClient = createPublicClient({
      chain: viemBaseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemBaseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
      account,
    }) as WalletClient;

    // Create CoFHE SDK config and client
    const config = createCofhesdkConfig({
      supportedChains: [baseSepolia],
    });
    cofhesdkClient = createCofhesdkClient(config);
    await cofhesdkClient.connect(publicClient, walletClient);
    await cofhesdkClient.permits.createSelf({
      name: 'Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1000000000000,
    });

    // Create a signer for Base Sepolia
    const baseSepoliaProvider = new hre.ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );
    baseSepoliaSigner = new hre.ethers.Wallet(TEST_PRIVATE_KEY, baseSepoliaProvider) as unknown as HardhatEthersSigner;

    if (deployments[baseSepolia.id]) {
      testContract = await hre.ethers.getContractAt(
        'SimpleTest',
        deployments[baseSepolia.id].address,
        baseSepoliaSigner
      );

      console.log(`Test contract already deployed at: ${deployments[baseSepolia.id].address}`);
    } else {
      // Deploy test contract using ethers
      const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
      testContract = await SimpleTestFactory.connect(baseSepoliaSigner).deploy();
      await testContract.waitForDeployment();
      const testContractAddress = await testContract.getAddress();
      deployments[baseSepolia.id] = { address: testContractAddress };

      console.log(`Test contract deployed at: ${testContractAddress}`);
    }
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    // Skip if no private key is provided
    if (!process.env.BASE_SEPOLIA_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    const testValue = 100n;

    // Encrypt and store a value
    const encryptedResult = await cofhesdkClient.encryptInputs([Encryptable.uint32(testValue)]).encrypt();
    const encrypted = (await hre.cofhesdk.expectResultSuccess(encryptedResult)) as [EncryptedItemInput];

    const tx = await testContract.connect(baseSepoliaSigner).setValue(encrypted[0]);
    const receipt = await tx.wait();
    console.log(`setValue transaction hash: ${receipt?.hash}`);

    // Get the hash from the contract (using the new getValueHash function)
    // IMPORTANT: The ctHash is transformed on-chain, so we MUST get it from the contract
    const ctHash = await testContract.getValueHash();
    console.log(`CT hash from contract getValueHash(): ${ctHash}`);

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofhesdkClient.decryptHandle(ctHash, FheTypes.Uint32).decrypt();
    console.log(`Unsealed result: ${unsealedResult}`, unsealedResult);

    // Verify the decrypted value matches
    await hre.cofhesdk.expectResultValue(unsealedResult, testValue);
  });
});
