import hre from 'hardhat';
import { baseSepolia, localcofhe } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { Chain, createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { baseSepolia as viemBaseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BASE_TEST_PRIVATE_KEY =
  process.env.TEST_PRIVATE_KEY ||
  DEFAULT_TEST_PRIVATE_KEY; /* This key is publicly known and should only be used for testing with testnet ETH. Do not use this key on mainnet or with real funds. */
const LOCALCOFHE_TEST_PRIVATE_KEY =
  process.env.LOCALCOFHE_PRIVATE_KEY || process.env.TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY;
const LOCALCOFHE_HOST_CHAIN_RPC = process.env.LOCALCOFHE_HOST_CHAIN_RPC || 'http://127.0.0.1:42069';

type SupportedTestChain = {
  label: string;
  sdkChain: typeof baseSepolia | typeof localcofhe;
  viemChain: typeof viemBaseSepolia | Chain;
  rpcUrl: string;
  privateKey: string;
  allowDefaultPrivateKey: boolean;
};

const parseChainIdEnv = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const asNumber = Number(trimmed);
  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    throw new Error(`Invalid COFHE_CHAIN_ID/TEST_CHAIN_ID: ${value}`);
  }
  return asNumber;
};

const ENV_CHAIN_ID = parseChainIdEnv(process.env.COFHE_CHAIN_ID ?? process.env.TEST_CHAIN_ID);

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
      http: [LOCALCOFHE_HOST_CHAIN_RPC],
    },
  },
};

const SUPPORTED_TEST_CHAINS: Record<number, SupportedTestChain> = {
  [baseSepolia.id]: {
    label: 'Base Sepolia',
    sdkChain: baseSepolia,
    viemChain: viemBaseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    privateKey: BASE_TEST_PRIVATE_KEY,
    allowDefaultPrivateKey: false,
  },
  [localcofhe.id]: {
    label: 'Local Cofhe',
    sdkChain: localcofhe,
    viemChain: viemLocalcofheChain,
    rpcUrl: LOCALCOFHE_HOST_CHAIN_RPC,
    privateKey: LOCALCOFHE_TEST_PRIVATE_KEY,
    allowDefaultPrivateKey: true,
  },
};

const deployments = {
  [baseSepolia.id]: {
    address: '0x50232BdA22A8bE7511655D430677EcF8e852C7B6',
  },
};

const selectedChainId = ENV_CHAIN_ID ?? baseSepolia.id;
const selectedChain = SUPPORTED_TEST_CHAINS[selectedChainId];

describe(`Encrypt/Decrypt Integration (${selectedChain?.label ?? `chainId=${selectedChainId}`})`, () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any; // ethers contract instance
  let chainSigner: HardhatEthersSigner;

  before(async function () {
    if (!selectedChain) {
      throw new Error(
        `Unsupported chainId=${selectedChainId}. Supported: ${Object.keys(SUPPORTED_TEST_CHAINS).join(', ')}`
      );
    }

    if (!selectedChain.allowDefaultPrivateKey && selectedChain.privateKey === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const account = privateKeyToAccount(selectedChain.privateKey as `0x${string}`);

    console.log(`Using chain: ${selectedChain.label}`);
    console.log(`Using RPC: ${selectedChain.rpcUrl}`);
    console.log(`Using account address: ${account.address}`);

    publicClient = createPublicClient({
      chain: selectedChain.viemChain,
      transport: http(selectedChain.rpcUrl),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: selectedChain.viemChain,
      transport: http(selectedChain.rpcUrl),
      account,
    }) as WalletClient;

    try {
      await publicClient.getBlockNumber();
    } catch (error) {
      console.warn(
        `Skipping ${selectedChain.label} integration test: RPC unavailable at ${selectedChain.rpcUrl}.`,
        error
      );
      this.skip();
    }

    const config = createCofheConfig({
      supportedChains: [selectedChain.sdkChain],
    });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);
    await cofheClient.permits.createSelf({
      name: 'Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1000000000000,
    });

    const chainProvider = new hre.ethers.JsonRpcProvider(selectedChain.rpcUrl);
    chainSigner = new hre.ethers.Wallet(selectedChain.privateKey, chainProvider) as unknown as HardhatEthersSigner;

    if (deployments[selectedChain.sdkChain.id]) {
      testContract = await hre.ethers.getContractAt(
        'SimpleTest',
        deployments[selectedChain.sdkChain.id].address,
        chainSigner
      );

      console.log(`Test contract already deployed at: ${deployments[selectedChain.sdkChain.id].address}`);
    } else {
      const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
      testContract = await SimpleTestFactory.connect(chainSigner).deploy();
      await testContract.waitForDeployment();
      const testContractAddress = await testContract.getAddress();
      deployments[selectedChain.sdkChain.id] = { address: testContractAddress };

      console.log(`Test contract deployed at: ${testContractAddress}`);
    }
  });

  it('Should encrypt -> store -> decrypt a value', async function () {
    if (!selectedChain.allowDefaultPrivateKey && selectedChain.privateKey === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const testValue = 100n;

    const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const tx = await testContract.connect(chainSigner).setValue(encrypted[0]);
    await tx.wait();

    const ctHash = await testContract.getValueHash();

    const unsealedResult = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

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
