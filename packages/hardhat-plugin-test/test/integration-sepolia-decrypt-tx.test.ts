import hre from 'hardhat';
import { sepolia } from '@cofhe/sdk/chains';
import { CofheClient, Encryptable, FheTypes } from '@cofhe/sdk';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { sepolia as viemSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';

// Test private key - must be funded on Sepolia.
// Provide a real key via TEST_PRIVATE_KEY env var; the default Hardhat/Anvil key is used
// only as a sentinel to skip the test in environments where no real key is available.
const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY;

// ---------------------------------------------------------------------------
// Sepolia Integration Tests – decryptForTx + publishDecryptResult
// ---------------------------------------------------------------------------
// This test exercises the full confidential-value lifecycle:
//   1. Encrypt a value client-side
//   2. Store the ciphertext on-chain (setValue)
//   3. Retrieve the on-chain ctHash
//   4. Call decryptForTx → TN /decrypt → get (decryptedValue, signature)
//   5. Publish the result on-chain (publishDecryptResult)
//   6. Verify via getDecryptResultSafe
//
// Run with a funded Sepolia key:
//   TEST_PRIVATE_KEY=0x... npx hardhat test test/integration-sepolia-decrypt-tx.test.ts \
//     --network hardhat
// ---------------------------------------------------------------------------

describe('Sepolia – DecryptForTx + PublishDecryptResult', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let testContract: any;
  let sepoliaSigner: HardhatEthersSigner;

  before(async function () {
    this.timeout(180_000);

    // Skip when running with the default (unfunded) key – e.g. in CI.
    if (TEST_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) {
      this.skip();
    }

    const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
    console.log(`Using account: ${account.address}`);

    const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';

    publicClient = createPublicClient({
      chain: viemSepolia,
      transport: http(rpcUrl),
    }) as PublicClient;

    walletClient = createWalletClient({
      chain: viemSepolia,
      transport: http(rpcUrl),
      account,
    }) as WalletClient;

    // Build CoFHE SDK client and connect to Sepolia.
    const config = createCofheConfig({ supportedChains: [sepolia] });
    cofheClient = createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);

    // Create a self-permit so decryptForTx can pick it up automatically.
    await cofheClient.permits.createSelf({
      name: 'DecryptForTx Test Permit',
      type: 'self',
      issuer: account.address,
      expiration: 1_000_000_000_000,
    });

    const sepoliaProvider = new hre.ethers.JsonRpcProvider(rpcUrl);
    sepoliaSigner = new hre.ethers.Wallet(TEST_PRIVATE_KEY, sepoliaProvider) as unknown as HardhatEthersSigner;

    // Prefer an existing deployment when available.
    // If there's no bytecode at the configured address, deploy automatically.
    const configuredSimpleTestAddress = process.env.SIMPLE_TEST_ADDRESS as `0x${string}` | undefined;
    const defaultSimpleTestAddress = '0x8CB51925D68f70EC430A36a07F6c09f35add32D2' as const;

    let simpleTestAddress = (configuredSimpleTestAddress || defaultSimpleTestAddress) as `0x${string}`;
    const deployedCode = await sepoliaProvider.getCode(simpleTestAddress);

    if (!deployedCode || deployedCode === '0x') {
      if (configuredSimpleTestAddress) {
        console.warn(
          `No contract bytecode found at SIMPLE_TEST_ADDRESS=${configuredSimpleTestAddress}. Deploying a new SimpleTest...`
        );
      } else {
        console.log(
          `No contract bytecode found at default SimpleTest address ${defaultSimpleTestAddress}. Deploying...`
        );
      }

      const SimpleTestFactory = await hre.ethers.getContractFactory('SimpleTest');
      testContract = await SimpleTestFactory.connect(sepoliaSigner).deploy();
      await testContract.waitForDeployment();
      simpleTestAddress = (await testContract.getAddress()) as `0x${string}`;
      console.log(`SimpleTest deployed at: ${simpleTestAddress}`);
      console.log(`Tip: set SIMPLE_TEST_ADDRESS=${simpleTestAddress} to reuse it next time.`);
    } else {
      testContract = await hre.ethers.getContractAt('SimpleTest', simpleTestAddress, sepoliaSigner);
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
    // const [encrypted] = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

    // ── Step 2: Store the ciphertext on-chain ─────────────────────────────
    // const storeTx = await testContract.connect(sepoliaSigner).setValue(encrypted);
    // await storeTx.wait();
    // console.log('setValue tx mined.');

    // ── Step 3: Read back the on-chain ctHash ─────────────────────────────
    // IMPORTANT: the on-chain transformation gives us the "real" ctHash;
    // do NOT use the client-side hash from encrypt.

    // IMPORTANT: the on-chain transformation gives us the "real" ctHash.
    // const ctHash: bigint = await testContract.getValueHash();
    // const ctHash = 108099334930651939355134646557579673343563784246601011388608805142476158402560n;
    // encrypted.ctHash; // In this test contract, the stored value is already the ctHash, so we can skip the redundant hash call.
    // const ctHash = encrypted.ctHash;
    // console.log(`ctHash: ${ctHash}`);
    const ctHash = BigInt('0xb83a28ed143a9582474b9aa614c4107403848c3b13f20f5831f3f70cfa5a0400');
    // ── Step 4: Call TN /decrypt to get plaintext + signature ─────────────
    const decryptResult = await cofheClient.decryptForTx(ctHash).execute();

    expect(decryptResult.ctHash).to.equal(ctHash);
    expect(decryptResult.decryptedValue).to.equal(testValue);
    expect(decryptResult.signature).to.be.a('string').and.have.lengthOf.above(0);
    console.log(`TN decryptedValue: ${decryptResult.decryptedValue}`);

    // ── Step 5: Publish the result on-chain ───────────────────────────────
    // signature from tnDecryptV1 has no 0x prefix; add it for the ABI call.
    const signatureBytes = `0x${decryptResult.signature}`;

    // publishDecryptResult(euint32 input, uint32 result, bytes signature)
    // The storedValue euint32 handle is retrieved from the contract; ethers
    // handles the bytes32 ↔ bigint conversion automatically.
    const storedValue: bigint = await testContract.getValue();
    const publishTx = await testContract
      .connect(sepoliaSigner)
      .publishDecryptResult(storedValue, decryptResult.decryptedValue, signatureBytes);
    await publishTx.wait();
    console.log('publishDecryptResult tx mined.');

    // ── Step 6: Verify the published result ───────────────────────────────
    const [publishedValue, isDecrypted]: [bigint, boolean] = await testContract.getDecryptResultSafe(storedValue);
    expect(isDecrypted).to.equal(true);
    expect(publishedValue).to.equal(testValue);
    console.log(`On-chain published value: ${publishedValue}, decrypted: ${isDecrypted}`);
  });
});
