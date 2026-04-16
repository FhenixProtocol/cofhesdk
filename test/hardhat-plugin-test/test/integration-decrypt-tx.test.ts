import { arbSepolia, baseSepolia, sepolia } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable } from '@cofhe/sdk';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { Ethers6Adapter } from '@cofhe/sdk/adapters';
import { expect } from 'chai';
import { JsonRpcProvider, NonceManager, Signature, Wallet } from 'ethers';
import * as ethers6 from 'ethers6';
import { SimpleTest, SimpleTest__factory } from '../typechain-types';

// Test private key - must be funded on Base Sepolia.
// Provide a real key via TEST_PRIVATE_KEY env var; the default Hardhat/Anvil key is used
// only as a sentinel to skip the test in environments where no real key is available.
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY;

type SupportedTestChain = {
  label: string;
  chainId: number;
  sdkChain: typeof sepolia | typeof baseSepolia | typeof arbSepolia;
  chainSpecificRpcEnvVar: 'SEPOLIA_RPC_URL' | 'BASE_SEPOLIA_RPC_URL' | 'ARBITRUM_SEPOLIA_RPC_URL';
  defaultRpcUrl: string;
};

const SUPPORTED_TEST_CHAINS: SupportedTestChain[] = [
  {
    label: 'Ethereum Sepolia',
    chainId: 11155111,
    sdkChain: sepolia,
    chainSpecificRpcEnvVar: 'SEPOLIA_RPC_URL',
    defaultRpcUrl: 'https://ethereum-sepolia.publicnode.com',
  },
  {
    label: 'Base Sepolia',
    chainId: 84532,
    sdkChain: baseSepolia,
    chainSpecificRpcEnvVar: 'BASE_SEPOLIA_RPC_URL',
    defaultRpcUrl: 'https://sepolia.base.org',
  },
  {
    label: 'Arbitrum Sepolia',
    chainId: 421614,
    sdkChain: arbSepolia,
    chainSpecificRpcEnvVar: 'ARBITRUM_SEPOLIA_RPC_URL',
    defaultRpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
  },
];

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

const findSupportedChainById = (chainId: number): SupportedTestChain | undefined =>
  SUPPORTED_TEST_CHAINS.find((c) => c.chainId === chainId);

import { getSimpleTestAddress } from '@cofhe/integration-test-setup';

// ---------------------------------------------------------------------------
// Chain-agnostic Integration Tests – decryptForTx + publishDecryptResult
// ---------------------------------------------------------------------------
// This test exercises the full confidential-value lifecycle:
//   1. Encrypt a value client-side
//   2. Store the ciphertext on-chain (setValue)
//   3. Retrieve the on-chain ctHash
//   4. Call decryptForTx → TN /decrypt → get (decryptedValue, signature)
//   5. Publish the result on-chain (publishDecryptResult)
//   6. Verify via getDecryptResultSafe
//
// Select chain by numeric chainId via COFHE_CHAIN_ID (or TEST_CHAIN_ID), or let it auto-detect via the RPC.
// Provide RPC via COFHE_RPC_URL (recommended) or RPC_URL.
// If COFHE_CHAIN_ID is set, you can also provide a chain-specific RPC var and it will be selected automatically:
//   - SEPOLIA_RPC_URL
//   - BASE_SEPOLIA_RPC_URL
//   - ARBITRUM_SEPOLIA_RPC_URL
//
// Contract address selection:
//   - Uses DEFAULT_SIMPLE_TEST_ADDRESSES_BY_CHAIN_ID in this file (keyed by chainId)
//
// Example:
//   COFHE_CHAIN_ID=84532 TEST_PRIVATE_KEY=0x... COFHE_RPC_URL=https://sepolia.base.org \
//     pnpm -C test/hardhat-plugin-test exec hardhat test test/integration-decrypt-tx.test.ts
// ---------------------------------------------------------------------------

const DESCRIBE_CHAIN_SUFFIX = ENV_CHAIN_ID ? ` (chainId=${ENV_CHAIN_ID})` : '';

describe(`DecryptForTx + PublishDecryptResult (chain-agnostic)${DESCRIBE_CHAIN_SUFFIX}`, () => {
  let cofheClient: CofheClient;
  let testContract: SimpleTest;
  let chainSigner: NonceManager;
  let selectedChain: SupportedTestChain;
  let selectedChainId: number;

  before(async function () {
    this.timeout(180_000);

    // Skip when running with the default (unfunded) key – e.g. in CI.
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const explicitRpcUrl = process.env.COFHE_RPC_URL || process.env.RPC_URL;

    // Resolve chainId:
    // - Prefer explicit env chain id.
    // - Otherwise require an explicit RPC and ask it for eth_chainId.
    if (ENV_CHAIN_ID) selectedChainId = ENV_CHAIN_ID;
    else {
      if (!explicitRpcUrl) {
        throw new Error(
          `COFHE_CHAIN_ID is not set and COFHE_RPC_URL/RPC_URL is not set. Provide either COFHE_CHAIN_ID (recommended) or an explicit RPC URL so the test can auto-detect chainId.`
        );
      }
      const preflightProvider = new ethers6.JsonRpcProvider(explicitRpcUrl);
      const network = await preflightProvider.getNetwork();
      selectedChainId = Number(network.chainId);
    }

    selectedChain =
      findSupportedChainById(selectedChainId) ??
      (() => {
        const supportedIds = SUPPORTED_TEST_CHAINS.map((c) => `${c.label}=${c.chainId}`).join(', ');
        throw new Error(`Unsupported chainId=${selectedChainId}. Supported: ${supportedIds}`);
      })();

    // Now that the chain is known, pick an RPC for *that* chain.
    const chainRpcUrl = process.env[selectedChain.chainSpecificRpcEnvVar];
    const rpcUrl = explicitRpcUrl || chainRpcUrl || selectedChain.defaultRpcUrl;

    console.log(`Resolved chainId: ${selectedChainId}`);
    console.log(`Using chain: ${selectedChain.label}`);
    console.log(`Using RPC: ${rpcUrl}`);

    // Safety: ensure the RPC matches the selected chainId.
    const rpcNetwork = await new ethers6.JsonRpcProvider(rpcUrl).getNetwork();
    const rpcChainId = Number(rpcNetwork.chainId);
    if (rpcChainId !== selectedChainId) {
      throw new Error(
        `RPC chainId (${rpcChainId}) does not match selected chainId (${selectedChainId}). Fix COFHE_CHAIN_ID or RPC URL.`
      );
    }

    // Build signers/providers.
    // - `ethers6` is used only to feed the SDK adapter (typed against ethers6).
    // - `ethers` is used for contract deployment/calls (typechain is generated against ethers).
    const adapterProvider = new ethers6.JsonRpcProvider(rpcUrl);
    const adapterWallet = new ethers6.Wallet(TEST_PRIVATE_KEY as `0x${string}`, adapterProvider);

    const contractProvider = new JsonRpcProvider(rpcUrl);
    // IMPORTANT: use a NonceManager so we always use the pending nonce.
    // This prevents intermittent "nonce too low" / "nonce already used" issues on
    // reruns when a previous run left a tx pending or when multiple txs are sent quickly.
    const baseWallet = new Wallet(TEST_PRIVATE_KEY as `0x${string}`, contractProvider);
    chainSigner = new NonceManager(baseWallet);
    console.log(`Using account: ${await chainSigner.getAddress()}`);

    const balance = await adapterProvider.getBalance(await adapterWallet.getAddress());
    if (balance === 0n) {
      console.warn(
        `Account ${await adapterWallet.getAddress()} has 0 ETH on ${selectedChain.label}. Fund it or set TEST_PRIVATE_KEY to a funded key for ${selectedChain.label}.`
      );
      this.skip();
    }

    // Create viem clients from the SDK's adapter so types match CofheClient.connect.
    const { publicClient, walletClient } = await Ethers6Adapter(adapterProvider, adapterWallet);

    // Build CoFHE SDK client and connect to the selected chain.
    const config = createCofheConfig({ supportedChains: [selectedChain.sdkChain] });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);

    // Create a self-permit so decryptForTx can pick it up automatically.
    await cofheClient.permits.createSelf({
      name: 'DecryptForTx Test Permit',
      type: 'self',
      issuer: (await adapterWallet.getAddress()) as `0x${string}`,
      expiration: 1_000_000_000_000,
    });

    // Read deployment address from registry (managed by scripts/integration-test-setup.mjs)
    const registryAddress = getSimpleTestAddress(selectedChainId);

    if (registryAddress) {
      const deployedCode = await contractProvider.getCode(registryAddress);
      if (deployedCode && deployedCode !== '0x') {
        testContract = SimpleTest__factory.connect(registryAddress, chainSigner);
      } else {
        console.warn(`No bytecode at registry address ${registryAddress}. Deploying a new SimpleTest...`);
      }
    }

    if (!testContract) {
      const simpleTestFactory = new SimpleTest__factory(chainSigner);
      testContract = await simpleTestFactory.deploy();
      await testContract.waitForDeployment();
      const simpleTestAddress = (await testContract.getAddress()) as `0x${string}`;
      console.log(`SimpleTest deployed at: ${simpleTestAddress}`);
      console.log(
        `Tip: run 'node test/hardhat-plugin-test/scripts/integration-test-setup.mjs --chains ${selectedChainId}' to persist this address.`
      );
    }

    console.log(`Using SimpleTest at: ${await testContract.getAddress()}`);
  });

  it('Should encrypt → store → decryptForTx → publishDecryptResult → verify', async function () {
    this.timeout(180_000);

    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const testValue = 42n;

    // ── Step 1: Encrypt the value client-side ──────────────────────────────
    const [encrypted] = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    // ── Step 2: Store the ciphertext on-chain ─────────────────────────────
    const storeTx = await testContract.connect(chainSigner).setValue(encrypted);
    await storeTx.wait();
    console.log('setValue tx mined.');

    // ── Step 3: Read back the on-chain ctHash ─────────────────────────────
    // IMPORTANT: the on-chain transformation gives us the "real" ctHash;
    // do NOT use the client-side hash from encrypt.

    // IMPORTANT: the on-chain transformation gives us the "real" ctHash.
    const ctHashHex = await testContract.getValueHash();
    const ctHash = BigInt(ctHashHex);
    console.log(`ctHash: ${ctHash}`);

    // ── Step 4: Call TN /decrypt to get plaintext + signature ─────────────
    const decryptResult = await cofheClient.decryptForTx(ctHash).withPermit().execute();

    expect(decryptResult.ctHash).to.equal(ctHash);
    expect(decryptResult.decryptedValue).to.equal(testValue);
    expect(decryptResult.signature).to.be.a('string').and.have.lengthOf.above(0);
    console.log(`TN decryptedValue: ${decryptResult.decryptedValue}`);

    // Verify decrypt signature via SDK client method
    const isValid = await cofheClient.verifyDecryptResult(ctHash, testValue, decryptResult.signature);
    expect(isValid).to.equal(true);

    // ── Step 5: Publish the result on-chain ───────────────────────────────
    // publishDecryptResult(euint32 input, uint32 result, bytes signature)
    // The storedValue euint32 handle is retrieved from the contract; ethers
    // handles the bytes32 ↔ bigint conversion automatically.
    const storedValue = await testContract.getValue();
    const publishTx = await testContract
      .connect(chainSigner)
      .publishDecryptResult(storedValue, decryptResult.decryptedValue, decryptResult.signature);
    await publishTx.wait();
    console.log('publishDecryptResult tx mined.');

    // ── Step 6: Verify the published result ───────────────────────────────
    const [publishedValue, isDecrypted]: [bigint, boolean] = await testContract.getDecryptResultSafe(storedValue);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(testValue);
    console.log(`On-chain published value: ${publishedValue}, decrypted: ${isDecrypted}`);
  });

  it('Should encrypt → store PUBLIC → decryptForTx (no permit) → publishDecryptResult → verify', async function () {
    this.timeout(180_000);

    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const testValue = 7n;

    // ── Step 1: Encrypt the value client-side ──────────────────────────────
    const [encrypted] = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    // ── Step 2: Store the ciphertext on-chain as PUBLIC (global allowance) ─
    const storeTx = await testContract.connect(chainSigner).setPublicValue(encrypted);
    await storeTx.wait();
    console.log('setPublicValue tx mined.');

    // ── Step 3: Read back the on-chain ctHash ─────────────────────────────
    // IMPORTANT: use the on-chain hash.
    const ctHashHex = await testContract.publicValueHash();
    const ctHash = BigInt(ctHashHex);
    console.log(`public ctHash: ${ctHash}`);

    // ── Step 4: Decrypt via TN /decrypt without a permit ──────────────────
    const decryptResult = await cofheClient.decryptForTx(ctHash).withoutPermit().execute();

    expect(decryptResult.ctHash).to.equal(ctHash);
    expect(decryptResult.decryptedValue).to.equal(testValue);
    expect(decryptResult.signature).to.be.a('string').and.have.lengthOf.above(0);
    console.log(`TN decryptedValue (public): ${decryptResult.decryptedValue}`);

    // Verify decrypt signature via SDK client method
    const isValid = await cofheClient.verifyDecryptResult(ctHash, testValue, decryptResult.signature);
    expect(isValid).to.equal(true);

    // ── Step 5: Publish the result on-chain ───────────────────────────────
    const publicValueHandle = await testContract.publicValue();
    const publishTx = await testContract
      .connect(chainSigner)
      .publishDecryptResult(publicValueHandle, decryptResult.decryptedValue, decryptResult.signature);
    await publishTx.wait();
    console.log('publishDecryptResult (public) tx mined.');

    // ── Step 6: Verify the published result ───────────────────────────────
    const [publishedValue, isDecrypted]: [bigint, boolean] = await testContract.getDecryptResultSafe(publicValueHandle);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(testValue);
    console.log(`On-chain published value (public): ${publishedValue}, decrypted: ${isDecrypted}`);
  });
});
