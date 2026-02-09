import hre from 'hardhat';
import { localcofhe } from '@cofhe/sdk/chains';
import { CofhesdkClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofhesdkClient, createCofhesdkConfig } from '@cofhe/sdk/node';
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
  let cofhesdkClient: CofhesdkClient;
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
    localcofheSigner = new hre.ethers.Wallet(
      process.env.LOCALCOFHE_PRIVATE_KEY as `0x${string}`,
      localcofheProvider
    ) as unknown as HardhatEthersSigner;

    // Deploy test contract using ethers
    const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTestFactory.connect(localcofheSigner).deploy();
    await testContract.waitForDeployment();
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    // Skip if no private key is provided
    if (!process.env.LOCALCOFHE_PRIVATE_KEY && process.env.CI) {
      this.skip();
    }

    const testValue = 101n;

    // Encrypt and store a value
    const encrypted = await cofhesdkClient.encryptInputs([Encryptable.uint32(testValue)]).encrypt();

    const tx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await tx.wait();

    // Get the hash from the contract (using the new getValueHash function)
    // IMPORTANT: The ctHash is transformed on-chain, so we MUST get it from the contract
    const ctHash = await testContract.getValueHash();

    // Decrypt the value using the ctHash from the encrypted input
    const unsealedResult = await cofhesdkClient.decryptHandle(ctHash, FheTypes.Uint32).decrypt();

    // Verify the decrypted value matches
    expect(unsealedResult).to.be.equal(testValue);
  });
});
