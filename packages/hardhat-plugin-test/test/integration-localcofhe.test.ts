import hre from 'hardhat';
import { localcofhe } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

const hostChainRpcUrl = process.env.LOCALCOFHE_HOST_CHAIN_RPC || 'http://127.0.0.1:42069';
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const localcofhePrivateKey =
  process.env.LOCALCOFHE_PRIVATE_KEY || process.env.TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY;

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
    const account = privateKeyToAccount(localcofhePrivateKey as `0x${string}`);

    publicClient = createPublicClient({
      chain: viemLocalcofheChain,
      transport: http(hostChainRpcUrl),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemLocalcofheChain,
      transport: http(hostChainRpcUrl),
      account,
    }) as WalletClient;

    try {
      await publicClient.getBlockNumber();
      const cofheResponse = await fetch(`${localcofhe.coFheUrl}/GetNetworkPublicKey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ securityZone: 0 }),
      });

      if (!cofheResponse.ok) {
        throw new Error(`CoFHE backend responded with status ${cofheResponse.status}`);
      }
    } catch (error) {
      console.warn(`Skipping localcofhe integration test: local services are unavailable.`, error);
      this.skip();
    }

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

    const localcofheProvider = new hre.ethers.JsonRpcProvider(hostChainRpcUrl);
    localcofheSigner = new hre.ethers.Wallet(
      localcofhePrivateKey as `0x${string}`,
      localcofheProvider
    ) as unknown as HardhatEthersSigner;

    const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
    testContract = await SimpleTestFactory.connect(localcofheSigner).deploy();
    await testContract.waitForDeployment();
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    const testValue = 101n;

    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const tx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await tx.wait();

    const ctHash = await testContract.getValueHash();

    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealedResult).to.be.equal(testValue);
  });
});
