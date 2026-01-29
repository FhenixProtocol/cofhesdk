import hre from 'hardhat';
import { localcofhe } from '@cofhe/sdk/chains';
import { CofhesdkClient, Encryptable, FheTypes, type EncryptedItemInput } from '@cofhe/sdk';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofhesdkClient, createCofhesdkConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

// Test private key - should be funded on localcofhe host chain
// Using a well-known test key, but you'll need to fund it with testnet ETH
const TEST_PRIVATE_KEY =
  process.env.LOCALCOFHE_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
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
  let cofhesdkClient: CofhesdkClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any; // ethers contract instance
  let localcofheSigner: HardhatEthersSigner;

  before(async function () {
    // Skip if no private key is provided (for CI/CD)
    if (!process.env.LOCALCOFHE_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    // Create viem clients for Local Cofhe
    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);

    console.log(`Using account address: ${account.address}`);

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
    const config = createCofhesdkConfig({
      supportedChains: [localcofhe],
    });
    cofhesdkClient = createCofhesdkClient(config);
    await cofhesdkClient.connect(publicClient, walletClient);
    await cofhesdkClient.permits.createSelf({
      name: 'Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1000000000000,
    });

    // Create a signer for Local Cofhe
    const localcofheProvider = new hre.ethers.JsonRpcProvider(hostChainRpcUrl);
    localcofheSigner = new hre.ethers.Wallet(TEST_PRIVATE_KEY, localcofheProvider) as unknown as HardhatEthersSigner;

    // Deploy test contract using ethers
    const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTestFactory.connect(localcofheSigner).deploy();
    await testContract.waitForDeployment();
    const testContractAddress = await testContract.getAddress();

    console.log(`Test contract deployed at: ${testContractAddress}`);
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    // Skip if no private key is provided
    if (!process.env.LOCALCOFHE_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    const testValue = 101n;

    // Encrypt and store a value
    const encryptedResult = await cofhesdkClient.encryptInputs([Encryptable.uint32(testValue)]).encrypt();
    const encrypted = (await hre.cofhesdk.expectResultSuccess(encryptedResult)) as [EncryptedItemInput];

    console.log(`Encrypted value`, encrypted[0]);

    const tx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
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
