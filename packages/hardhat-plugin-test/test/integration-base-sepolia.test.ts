import hre from 'hardhat';
import { baseSepolia } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { baseSepolia as viemBaseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { PermitUtils } from '@cofhe/sdk/permits';

// Test private key - should be funded on Base Sepolia
// Using a well-known test key, but you'll need to fund it with testnet ETH
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PRIVATE_KEY =
  process.env.TEST_PRIVATE_KEY ||
  DEFAULT_TEST_PRIVATE_KEY; /* This key is publicly known and should only be used for testing with testnet ETH. Do not use this key on mainnet or with real funds. */

const deployments = {
  [baseSepolia.id]: {
    address: '0x50232BdA22A8bE7511655D430677EcF8e852C7B6',
  },
};

describe('Base Sepolia Integration Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any; // ethers contract instance
  let baseSepoliaSigner: HardhatEthersSigner;
  let accountAddress: `0x${string}`;

  before(async function () {
    // Skip if no private key is provided (for CI/CD)
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    // Create viem clients for Base Sepolia
    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
    accountAddress = account.address;

    console.log(`Using account address: ${accountAddress}`);

    publicClient = createPublicClient({
      chain: viemBaseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemBaseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
      account,
    }) as WalletClient;

    const balance = await publicClient.getBalance({ address: accountAddress });
    if (balance === 0n) {
      throw new Error(
        `Base Sepolia integration account ${accountAddress} has 0 ETH. Top up TEST_PRIVATE_KEY on Base Sepolia before rerunning CI.`
      );
    }

    // Create CoFHE SDK config and client
    const config = createCofheConfig({
      supportedChains: [baseSepolia],
    });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);
    await cofheClient.permits.createSelf({
      name: 'Test Permit',
      type: 'self',
      issuer: accountAddress,
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
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const testValue = 100n;

    // Encrypt and store a value
    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const tx = await testContract.connect(baseSepoliaSigner).setValue(encrypted[0]);
    const receipt = await tx.wait();

    // Get the hash from the contract (using the new getValueHash function)
    // IMPORTANT: The ctHash is transformed on-chain, so we MUST get it from the contract
    const ctHash = await testContract.getValueHash();

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    // Verify the decrypted value matches
    expect(unsealedResult).to.be.equal(testValue);
  });

  // TODO: UNCOMMENT WHEN UPDATED ACL DEPLOYED

  // it('Permit should be valid on chain', async function () {
  //   const permit = await cofheClient.permits.createSelf({
  //     issuer: baseSepoliaSigner.address,
  //     name: 'Test Permit',
  //   });

  //   const isValid = await PermitUtils.checkValidityOnChain(permit, cofheClient.getSnapshot().publicClient!);

  //   expect(isValid).to.be.true;
  // });

  // it('Expired permit should revert with PermissionInvalid_Expired', async function () {
  //   const permit = await cofheClient.permits.createSelf({
  //     issuer: baseSepoliaSigner.address,
  //     name: 'Test Permit',
  //     expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  //   });

  //   try {
  //     await PermitUtils.checkValidityOnChain(permit, cofheClient.getSnapshot().publicClient!);
  //   } catch (error) {
  //     expect(error).to.be.instanceOf(Error);
  //     expect((error as Error).message).to.be.equal('PermissionInvalid_Expired');
  //   }
  // });

  // it('Invalid issuer signature should revert with PermissionInvalid_IssuerSignature', async function () {
  //   const permit = await cofheClient.permits.createSelf({
  //     issuer: baseSepoliaSigner.address,
  //     name: 'Test Permit',
  //   });

  //   permit.issuerSignature = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  //   try {
  //     await PermitUtils.checkValidityOnChain(permit, cofheClient.getSnapshot().publicClient!);
  //   } catch (error) {
  //     expect(error).to.be.instanceOf(Error);
  //     expect((error as Error).message).to.be.equal('PermissionInvalid_IssuerSignature');
  //   }
  // });
});
