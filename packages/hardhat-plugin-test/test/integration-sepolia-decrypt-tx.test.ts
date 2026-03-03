import hre from 'hardhat';
import { arbSepolia, baseSepolia, sepolia } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable } from '@cofhe/sdk';
import { type Chain, type PublicClient, type WalletClient, createPublicClient, createWalletClient, http } from 'viem';
import { arbitrumSepolia as viemArbSepolia, baseSepolia as viemBaseSepolia, sepolia as viemSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { expect } from 'chai';
import { Signature, type Contract, type Signer } from 'ethers';

// Test private key - must be funded on Base Sepolia.
// Provide a real key via TEST_PRIVATE_KEY env var; the default Hardhat/Anvil key is used
// only as a sentinel to skip the test in environments where no real key is available.
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY;

type SupportedTestChain = {
  label: string;
  sdkChain: typeof sepolia | typeof baseSepolia | typeof arbSepolia;
  viemChain: Chain;
  chainSpecificRpcEnvVar: 'SEPOLIA_RPC_URL' | 'BASE_SEPOLIA_RPC_URL' | 'ARBITRUM_SEPOLIA_RPC_URL';
  defaultRpcUrl: string;
};

const SUPPORTED_TEST_CHAINS: SupportedTestChain[] = [
  {
    label: 'Ethereum Sepolia',
    sdkChain: sepolia,
    viemChain: viemSepolia,
    chainSpecificRpcEnvVar: 'SEPOLIA_RPC_URL',
    defaultRpcUrl: 'https://ethereum-sepolia.publicnode.com',
  },
  {
    label: 'Base Sepolia',
    sdkChain: baseSepolia,
    viemChain: viemBaseSepolia,
    chainSpecificRpcEnvVar: 'BASE_SEPOLIA_RPC_URL',
    defaultRpcUrl: 'https://sepolia.base.org',
  },
  {
    label: 'Arbitrum Sepolia',
    sdkChain: arbSepolia,
    viemChain: viemArbSepolia,
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
  SUPPORTED_TEST_CHAINS.find((c) => c.viemChain.id === chainId);

const getConfiguredSimpleTestAddress = (chainId: number): `0x${string}` | undefined => {
  // Global override: applies regardless of chain.
  const global = process.env.SIMPLE_TEST_ADDRESS as `0x${string}` | undefined;
  if (global) return global;

  // Chain-specific override by chainId.
  // Examples: SIMPLE_TEST_ADDRESS_84532, SIMPLE_TEST_ADDRESS_CHAIN_84532
  const direct = process.env[`SIMPLE_TEST_ADDRESS_${chainId}`] as `0x${string}` | undefined;
  if (direct) return direct;
  return process.env[`SIMPLE_TEST_ADDRESS_CHAIN_${chainId}`] as `0x${string}` | undefined;
};

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
// Contract address override (optional):
//   - SIMPLE_TEST_ADDRESS (global)
//   - SIMPLE_TEST_ADDRESS_<chainId> (e.g. SIMPLE_TEST_ADDRESS_84532)
//   - SIMPLE_TEST_ADDRESS_CHAIN_<chainId> (e.g. SIMPLE_TEST_ADDRESS_CHAIN_84532)
//
// Example:
//   COFHE_CHAIN_ID=84532 TEST_PRIVATE_KEY=0x... COFHE_RPC_URL=https://sepolia.base.org SIMPLE_TEST_ADDRESS_84532=0x... \
//     pnpm -C packages/hardhat-plugin-test exec hardhat test test/integration-sepolia-decrypt-tx.test.ts
// ---------------------------------------------------------------------------

const DESCRIBE_CHAIN_SUFFIX = ENV_CHAIN_ID ? ` (chainId=${ENV_CHAIN_ID})` : '';

describe(`DecryptForTx + PublishDecryptResult (chain-agnostic)${DESCRIBE_CHAIN_SUFFIX}`, () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: Contract;
  let chainSigner: Signer;
  let selectedChain: SupportedTestChain;
  let selectedChainId: number;

  before(async function () {
    this.timeout(180_000);

    // Skip when running with the default (unfunded) key – e.g. in CI.
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
    console.log(`Using account: ${account.address}`);

    const explicitRpcUrl = process.env.COFHE_RPC_URL || process.env.RPC_URL;

    // Resolve chainId:
    // - Prefer explicit env chain id.
    // - Otherwise require an explicit RPC and ask it for eth_chainId.
    if (ENV_CHAIN_ID) {
      selectedChainId = ENV_CHAIN_ID;
    } else {
      if (!explicitRpcUrl) {
        throw new Error(
          `COFHE_CHAIN_ID is not set and COFHE_RPC_URL/RPC_URL is not set. Provide either COFHE_CHAIN_ID (recommended) or an explicit RPC URL so the test can auto-detect chainId.`
        );
      }

      const preflightPublicClient = createPublicClient({
        transport: http(explicitRpcUrl),
      });

      try {
        selectedChainId = await preflightPublicClient.getChainId();
      } catch (e) {
        throw new Error(
          `Failed to detect chainId from RPC (${explicitRpcUrl}). Set COFHE_CHAIN_ID explicitly. Underlying error: ${e}`
        );
      }
    }

    selectedChain =
      findSupportedChainById(selectedChainId) ??
      (() => {
        const supportedIds = SUPPORTED_TEST_CHAINS.map((c) => `${c.label}=${c.viemChain.id}`).join(', ');
        throw new Error(`Unsupported chainId=${selectedChainId}. Supported: ${supportedIds}`);
      })();

    // Now that the chain is known, pick an RPC for *that* chain.
    const chainRpcUrl = process.env[selectedChain.chainSpecificRpcEnvVar];
    const rpcUrl = explicitRpcUrl || chainRpcUrl || selectedChain.defaultRpcUrl;

    console.log(`Resolved chainId: ${selectedChainId}`);
    console.log(`Using chain: ${selectedChain.label}`);
    console.log(`Using RPC: ${rpcUrl}`);

    // Safety: ensure the RPC matches the selected chainId.
    try {
      const rpcChainId = await createPublicClient({ transport: http(rpcUrl) }).getChainId();
      if (rpcChainId !== selectedChainId) {
        throw new Error(
          `RPC chainId (${rpcChainId}) does not match selected chainId (${selectedChainId}). Fix COFHE_CHAIN_ID or RPC URL.`
        );
      }
    } catch (e) {
      // If the RPC can't answer eth_chainId reliably, we still proceed.
      // But when it *does* answer and mismatches, we hard-fail above.
      if (String(e).includes('does not match selected chainId')) throw e;
    }

    publicClient = createPublicClient({
      chain: selectedChain.viemChain,
      transport: http(rpcUrl),
    });

    const balance = await publicClient.getBalance({ address: account.address });
    if (balance === 0n) {
      console.warn(
        `Account ${account.address} has 0 ETH on ${selectedChain.label}. Fund it or set TEST_PRIVATE_KEY to a funded key for ${selectedChain.label}.`
      );
      this.skip();
    }

    walletClient = createWalletClient({
      chain: selectedChain.viemChain,
      transport: http(rpcUrl),
      account,
    });

    // Build CoFHE SDK client and connect to the selected chain.
    const config = createCofheConfig({ supportedChains: [selectedChain.sdkChain] });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);

    // Create a self-permit so decryptForTx can pick it up automatically.
    await cofheClient.permits.createSelf({
      name: 'DecryptForTx Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1_000_000_000_000,
    });

    const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
    chainSigner = new hre.ethers.Wallet(TEST_PRIVATE_KEY, provider);

    // Prefer an explicitly configured deployment when available.
    // Otherwise deploy a fresh contract (older deployments may point at stale TaskManager / signer configs).
    const configuredSimpleTestAddress = getConfiguredSimpleTestAddress(selectedChainId);

    if (configuredSimpleTestAddress) {
      const deployedCode = await provider.getCode(configuredSimpleTestAddress);
      if (deployedCode && deployedCode !== '0x') {
        testContract = await hre.ethers.getContractAt('SimpleTest', configuredSimpleTestAddress, chainSigner);
      } else {
        console.warn(
          `No contract bytecode found at configured SimpleTest address ${configuredSimpleTestAddress}. Deploying a new SimpleTest...`
        );
      }
    }

    if (!testContract) {
      const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
      testContract = await SimpleTestFactory.connect(chainSigner).deploy();
      await testContract.waitForDeployment();
      const simpleTestAddress = (await testContract.getAddress()) as `0x${string}`;
      console.log(`SimpleTest deployed at: ${simpleTestAddress}`);
      console.log(`Tip: set SIMPLE_TEST_ADDRESS=${simpleTestAddress} to reuse it next time.`);
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
    const ctHash: bigint = await testContract.getValueHash();
    console.log(`ctHash: ${ctHash}`);

    // ── Step 4: Call TN /decrypt to get plaintext + signature ─────────────
    const decryptResult = await cofheClient.decryptForTx(ctHash).withPermit().execute();

    expect(decryptResult.ctHash).to.equal(ctHash);
    expect(decryptResult.decryptedValue).to.equal(testValue);
    expect(decryptResult.signature).to.be.a('string').and.have.lengthOf.above(0);
    console.log(`TN decryptedValue: ${decryptResult.decryptedValue}`);

    // ── Step 5: Publish the result on-chain ───────────────────────────────
    // The task manager verifies ECDSA signatures using OpenZeppelin ECDSA, which rejects
    // non-canonical signatures (eg high-s). Normalize to a canonical (low-s) signature.
    const signatureHex = decryptResult.signature.startsWith('0x')
      ? (decryptResult.signature as `0x${string}`)
      : (`0x${decryptResult.signature}` as `0x${string}`);
    const signatureBytes = Signature.from(signatureHex).serialized;

    // publishDecryptResult(euint32 input, uint32 result, bytes signature)
    // The storedValue euint32 handle is retrieved from the contract; ethers
    // handles the bytes32 ↔ bigint conversion automatically.
    const storedValue: bigint = await testContract.getValue();
    const publishTx = await testContract
      .connect(chainSigner)
      .publishDecryptResult(storedValue, decryptResult.decryptedValue, signatureBytes);
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
    const ctHash: bigint = await testContract.publicValueHash();
    console.log(`public ctHash: ${ctHash}`);

    // ── Step 4: Decrypt via TN /decrypt without a permit ──────────────────
    const decryptResult = await cofheClient.decryptForTx(ctHash).withoutPermit().execute();

    expect(decryptResult.ctHash).to.equal(ctHash);
    expect(decryptResult.decryptedValue).to.equal(testValue);
    expect(decryptResult.signature).to.be.a('string').and.have.lengthOf.above(0);
    console.log(`TN decryptedValue (public): ${decryptResult.decryptedValue}`);

    // ── Step 5: Publish the result on-chain ───────────────────────────────
    const signatureHex = decryptResult.signature.startsWith('0x')
      ? (decryptResult.signature as `0x${string}`)
      : (`0x${decryptResult.signature}` as `0x${string}`);
    const signatureBytes = Signature.from(signatureHex).serialized;

    const publicValueHandle: bigint = await testContract.publicValue();
    const publishTx = await testContract
      .connect(chainSigner)
      .publishDecryptResult(publicValueHandle, decryptResult.decryptedValue, signatureBytes);
    await publishTx.wait();
    console.log('publishDecryptResult (public) tx mined.');

    // ── Step 6: Verify the published result ───────────────────────────────
    const [publishedValue, isDecrypted]: [bigint, boolean] = await testContract.getDecryptResultSafe(publicValueHandle);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(testValue);
    console.log(`On-chain published value (public): ${publishedValue}, decrypted: ${isDecrypted}`);
  });
});
