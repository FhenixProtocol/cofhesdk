import hre from 'hardhat';
import { localcofhe } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { getSimpleTestAddress } from '@cofhe/integration-test-setup';

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
  let testContract: any;
  let localcofheSigner: HardhatEthersSigner;

  before(async function () {
    if (process.env.TEST_LOCALCOFHE_ENABLED !== 'true' || !process.env.TEST_LOCALCOFHE_PRIVATE_KEY) {
      this.skip();
    }

    const account = privateKeyToAccount(process.env.TEST_LOCALCOFHE_PRIVATE_KEY as `0x${string}`);

    publicClient = createPublicClient({
      chain: viemLocalcofheChain,
      transport: http(hostChainRpcUrl),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemLocalcofheChain,
      transport: http(hostChainRpcUrl),
      account,
    }) as WalletClient;

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
      process.env.TEST_LOCALCOFHE_PRIVATE_KEY as `0x${string}`,
      localcofheProvider
    ) as unknown as HardhatEthersSigner;

    const simpleTestAddress = getSimpleTestAddress(localcofhe.id);
    if (!simpleTestAddress) {
      console.error(
        `No SimpleTest deployment found for localcofhe (${localcofhe.id}). Run: node test/integration-test-setup/setup.mjs --chains ${localcofhe.id}`
      );
      this.skip();
    }

    testContract = await hre.ethers.getContractAt('SimpleTest', simpleTestAddress, localcofheSigner);
    console.log(`Using SimpleTest at: ${simpleTestAddress}`);
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    if (process.env.TEST_LOCALCOFHE_ENABLED !== 'true' || !process.env.TEST_LOCALCOFHE_PRIVATE_KEY) {
      this.skip();
    }

    const testValue = 101n;

    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const tx = await testContract.connect(localcofheSigner).setValue(encrypted[0]);
    await tx.wait();

    const ctHash = await testContract.getValueHash();

    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

    expect(unsealedResult).to.be.equal(testValue);
  });
});
