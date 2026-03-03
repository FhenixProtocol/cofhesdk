import hre from 'hardhat';
import { baseSepolia } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable } from '@cofhe/sdk';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { baseSepolia as viemBaseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { Signature } from 'ethers';

// Test private key - must be funded on Base Sepolia.
// Provide a real key via TEST_PRIVATE_KEY env var; the default Hardhat/Anvil key is used
// only as a sentinel to skip the test in environments where no real key is available.
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY;

// ---------------------------------------------------------------------------
// Base Sepolia Integration Tests – decryptForTx + publishDecryptResult
// ---------------------------------------------------------------------------
// This test exercises the full confidential-value lifecycle:
//   1. Encrypt a value client-side
//   2. Store the ciphertext on-chain (setValue)
//   3. Retrieve the on-chain ctHash
//   4. Call decryptForTx → TN /decrypt → get (decryptedValue, signature)
//   5. Publish the result on-chain (publishDecryptResult)
//   6. Verify via getDecryptResultSafe
//
// Run with a funded Base Sepolia key:
//   TEST_PRIVATE_KEY=0x... BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
//     pnpm -C packages/hardhat-plugin-test exec hardhat test test/integration-sepolia-decrypt-tx.test.ts
// ---------------------------------------------------------------------------

describe('Base Sepolia – DecryptForTx + PublishDecryptResult', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any;
  let baseSepoliaSigner: HardhatEthersSigner;

  before(async function () {
    this.timeout(180_000);

    // Skip when running with the default (unfunded) key – e.g. in CI.
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
    console.log(`Using account: ${account.address}`);

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

    publicClient = createPublicClient({
      chain: viemBaseSepolia,
      transport: http(rpcUrl),
    }) as PublicClient;

    const balance = await publicClient.getBalance({ address: account.address });
    if (balance === 0n) {
      console.warn(
        `Account ${account.address} has 0 ETH on Base Sepolia. Fund it or set TEST_PRIVATE_KEY to a funded Base Sepolia key.`
      );
      this.skip();
    }

    walletClient = createWalletClient({
      chain: viemBaseSepolia,
      transport: http(rpcUrl),
      account,
    }) as WalletClient;

    // Build CoFHE SDK client and connect to Base Sepolia.
    const config = createCofheConfig({ supportedChains: [baseSepolia] });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);

    // Create a self-permit so decryptForTx can pick it up automatically.
    await cofheClient.permits.createSelf({
      name: 'DecryptForTx Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1_000_000_000_000,
    });

    const baseSepoliaProvider = new hre.ethers.JsonRpcProvider(rpcUrl);
    baseSepoliaSigner = new hre.ethers.Wallet(TEST_PRIVATE_KEY, baseSepoliaProvider) as unknown as HardhatEthersSigner;

    // Prefer an explicitly configured deployment when available.
    // Otherwise deploy a fresh contract (older deployments may point at stale TaskManager / signer configs).
    const configuredSimpleTestAddress = process.env.SIMPLE_TEST_ADDRESS as `0x${string}` | undefined;

    if (configuredSimpleTestAddress) {
      const deployedCode = await baseSepoliaProvider.getCode(configuredSimpleTestAddress);
      if (deployedCode && deployedCode !== '0x') {
        testContract = await hre.ethers.getContractAt('SimpleTest', configuredSimpleTestAddress, baseSepoliaSigner);
      } else {
        console.warn(
          `No contract bytecode found at SIMPLE_TEST_ADDRESS=${configuredSimpleTestAddress}. Deploying a new SimpleTest...`
        );
      }
    }

    if (!testContract) {
      const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
      testContract = await SimpleTestFactory.connect(baseSepoliaSigner).deploy();
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
    const storeTx = await testContract.connect(baseSepoliaSigner).setValue(encrypted);
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
      .connect(baseSepoliaSigner)
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
    const storeTx = await testContract.connect(baseSepoliaSigner).setPublicValue(encrypted);
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
      .connect(baseSepoliaSigner)
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
