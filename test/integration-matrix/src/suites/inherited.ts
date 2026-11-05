/**
 * Shared inherited test suite.
 *
 * Contains all SDK-level tests that should behave identically across
 * every chain (mock or production) and every environment (node or web).
 *
 * NOTE: Must not use process.env in this file.
 */

import { it, describe, expect, beforeAll, afterAll } from 'vitest';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import {
  ACPUtils,
  describeShareMetadata,
  encodeShareMetadata,
  viewFunctionLabel,
  type ACPPublic,
} from '@cofhe/sdk/acps';
import { simpleTestAbi, TEST_ALICE_KEY_PROVIDED } from '@cofhe/test-setup';
import type { TestChainConfig, ClientFactory, TestContext } from '../types.js';

function makeThresholdRequestBody(chainConfig: TestChainConfig, ctHash: bigint | string, acp: ACPPublic) {
  return {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: chainConfig.cofheChain.id,
    acp,
  };
}

export function runInheritedSuite(chainConfig: TestChainConfig, factory: ClientFactory) {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
  }, 60_000);

  afterAll(async () => {
    await chainConfig.teardown?.();
  });

  it('Clients should be created with expected surface', () => {
    expect(ctx.cofheClient).toBeDefined();
    expect(ctx.cofheClient.config).toBeDefined();
    expect(ctx.cofheClient.connected).toBe(true);
    expect(typeof ctx.cofheClient.connect).toBe('function');
    expect(typeof ctx.cofheClient.disconnect).toBe('function');
    expect(typeof ctx.cofheClient.encryptInputs).toBe('function');
    expect(typeof ctx.cofheClient.decryptForView).toBe('function');
    expect(typeof ctx.cofheClient.decryptForTx).toBe('function');
    expect(typeof ctx.cofheClient.getSnapshot).toBe('function');
    expect(typeof ctx.cofheClient.subscribe).toBe('function');
    expect(ctx.cofheClient.acp).toBeDefined();
  });

  it('Clients should connect successfully', () => {
    const snapshot = ctx.cofheClient.getSnapshot();
    expect(snapshot.connected).toBe(true);
    expect(snapshot.chainId).toBe(chainConfig.id);
    expect(snapshot.account).toBe(ctx.bobAccount.address);
  });

  it('Should encrypt a uint128 input', async () => {
    const encrypted = await ctx.cofheClient
      .encryptInputs([Encryptable.uint128(100n)])
      .setConsumingContract(ctx.contractAddress)
      .execute();

    // [hash, signature] - one hash per input, followed by the single signature that
    // authenticates the whole batch.
    expect(encrypted).toBeDefined();
    expect(encrypted.length).toBe(2);

    const [hash, signature] = encrypted;
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^0x[0-9a-f]+$/i);
    expect(typeof signature).toBe('string');
    expect(signature).toMatch(/^0x[0-9a-f]+$/i);
  }, 60_000);

  it('ACPs - should create a self acp', async () => {
    const acp = await ctx.cofheClient.acp.createSelf({
      issuer: ctx.bobAccount.address,
      name: 'Test Self ACP',
    });

    expect(acp).toBeDefined();
    expect(acp.type).toBe('self');
    expect(acp.name).toBe('Test Self ACP');
    expect(acp.issuer).toBe(ctx.bobAccount.address);
    expect(acp.issuerSignature).not.toBe('0x');
    expect(acp.sealingPrivateKey).toBeDefined();
    expect(acp.sealingKey).toBeDefined();

    const activeACP = ctx.cofheClient.acp.getActiveACP();
    expect(activeACP).toBeDefined();
    expect(activeACP!.hash).toBe(acp.hash);
  }, 30_000);

  it('ACPs - should create a sharing acp, export it, and import it as another user', async () => {
    const sharingACP = await ctx.cofheClient.acp.createSharing({
      issuer: ctx.bobAccount.address,
      recipient: ctx.aliceAccount.address,
      name: 'Test Sharing ACP',
    });

    expect(sharingACP).toBeDefined();
    expect(sharingACP.type).toBe('sharing');
    expect(sharingACP.issuer).toBe(ctx.bobAccount.address);
    expect(sharingACP.recipient).toBe(ctx.aliceAccount.address);
    expect(sharingACP.issuerSignature).not.toBe('0x');

    const exported = ctx.cofheClient.acp.export(sharingACP);
    expect(exported).toBeDefined();
    const parsed = JSON.parse(exported);
    expect(parsed.type).toBe('sharing');
    expect(parsed.issuer).toBe(ctx.bobAccount.address);
    expect(parsed.recipient).toBe(ctx.aliceAccount.address);
    expect(parsed.issuerSignature).toBeDefined();
    expect(parsed).not.toHaveProperty('sealingPrivateKey');

    // Alice imports the shared acp via a fresh client
    const aliceConfig = factory.createConfig({
      supportedChains: [chainConfig.cofheChain],
      ...(chainConfig.id === 31337
        ? {
            environment: 'hardhat' as const,
            mocks: { encryptDelay: 0 },
          }
        : {}),
    });
    const aliceClient = factory.createClient(aliceConfig);
    await aliceClient.connect(ctx.publicClient, ctx.aliceWalletClient);

    const importedACP = await aliceClient.acp.importShared(exported);

    expect(importedACP).toBeDefined();
    expect(importedACP.type).toBe('recipient');
    expect(importedACP.issuer).toBe(ctx.bobAccount.address);
    expect(importedACP.recipient).toBe(ctx.aliceAccount.address);
    expect(importedACP.recipientSignature).not.toBe('0x');
    expect(importedACP.sealingPrivateKey).toBeDefined();
  }, 30_000);

  let alreadyFetchedCtHash: bigint | string;
  describe('Full encrypt->increment->decrypt flow + refetch cached response', () => {
    const testValue = 100n;
    it('Should encrypt a multi-input batch under one shared signature', async () => {
      await ctx.cofheClient.acp.createSelf({
        issuer: ctx.bobAccount.address,
        name: 'Encrypt View ACP',
      });

      // Two inputs, one signature over keccak256(h_0 || h_1) - the contract verifies the whole
      // batch in a single call and only reads the first value.
      const [firstHash, secondHash, signature] = await ctx.cofheClient
        .encryptInputs([Encryptable.uint32(testValue), Encryptable.uint32(testValue + 1n)])
        .setConsumingContract(ctx.contractAddress)
        .execute();

      const txHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'setValueBatch',
        args: [[firstHash, secondHash], signature],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({
        hash: txHash,
        retryCount: 30,
        pollingInterval: 4_000,
        confirmations: chainConfig.txConfirmationsRequired,
      });

      const ctHash = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      });

      const result = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

      expect(result).toBe(testValue);
    });
    it('Decrypt for View (with acp) - should encrypt → store → decryptForView a value', async () => {
      await ctx.cofheClient.acp.createSelf({
        issuer: ctx.bobAccount.address,
        name: 'Decrypt View ACP',
      });

      const [hash, signature] = await ctx.cofheClient
        .encryptInputs([Encryptable.uint32(testValue)])
        .setConsumingContract(ctx.contractAddress)
        .execute();

      const txHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'setValueBatch',
        args: [[hash], signature],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({
        hash: txHash,
        retryCount: 30,
        pollingInterval: 4_000,
        confirmations: chainConfig.txConfirmationsRequired,
      });

      const ctHash = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      });

      const result = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

      expect(result).toBe(testValue);
    }, 180_000);

    const valueToAdd = 7n;
    const expectedViewValue = testValue + valueToAdd;
    it('successfully decrypts a new on-chain-produced ctHash with decryptForView, transparently retrying until the backend has it', async () => {
      const [addendHash, addendSignature] = await ctx.cofheClient
        .encryptInputs([Encryptable.uint32(valueToAdd)])
        .setConsumingContract(ctx.contractAddress)
        .execute();

      // This on-chain FHE op produces a fresh ctHash that decryptForView consumes next.
      // The SDK should retry transparently if the backend still responds with 404 or no content.
      const addTxHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'addValueBatch',
        args: [[addendHash], addendSignature],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({
        hash: addTxHash,
        retryCount: 30,
        pollingInterval: 4_000,
        confirmations: chainConfig.txConfirmationsRequired,
      });

      const ctHash = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      });

      const unsealedResult = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
      expect(unsealedResult).toBe(expectedViewValue);
    }, 180_000);

    it('successfully decrypts a new on-chain-produced ctHash with decryptForTx, transparently retrying until the backend has it', async () => {
      const secondValueToAdd = 11n;
      const expectedTxValue = expectedViewValue + secondValueToAdd;
      const [secondAddendHash, secondAddendSignature] = await ctx.cofheClient
        .encryptInputs([Encryptable.uint32(secondValueToAdd)])
        .setConsumingContract(ctx.contractAddress)
        .execute();

      // This second on-chain FHE op again produces a fresh ctHash for decryptForTx.
      // The SDK should keep retrying until the backend has both discovered and computed it.
      const secondAddTxHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'addValueBatch',
        args: [[secondAddendHash], secondAddendSignature],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({
        hash: secondAddTxHash,
        retryCount: 30,
        pollingInterval: 4_000,
        confirmations: chainConfig.txConfirmationsRequired,
      });

      const updatedCtHash = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      });

      const decryptResult = await ctx.cofheClient.decryptForTx(updatedCtHash).withACP().execute();
      // now that it was fetched - next time it should fetch from cache
      alreadyFetchedCtHash = updatedCtHash;

      expect(decryptResult.ctHash).toBe(updatedCtHash);
      expect(decryptResult.decryptedValue).toBe(expectedTxValue);
      expect(typeof decryptResult.signature).toBe('string');

      const publishTxHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'publishDecryptResult',
        args: [updatedCtHash, Number(decryptResult.decryptedValue), decryptResult.signature],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({
        hash: publishTxHash,
        retryCount: 30,
        pollingInterval: 4_000,
        confirmations: chainConfig.txConfirmationsRequired,
      });

      const [publishedValue, isDecrypted] = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getDecryptResultSafe',
        args: [updatedCtHash],
      });

      expect(isDecrypted).toBe(true);
      expect(BigInt(publishedValue)).toBe(expectedTxValue);
    }, 180_000);

    it.skipIf(chainConfig.id === 31337)(
      '200 -> from cache',
      async () => {
        const activeACP = ctx.cofheClient.acp.getActiveACP();

        const secondSubmitResponse = await fetch(`${chainConfig.cofheChain.thresholdNetworkUrl}/v2/decrypt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            makeThresholdRequestBody(chainConfig, alreadyFetchedCtHash, ACPUtils.getPublic(activeACP!, true))
          ),
        });

        expect(secondSubmitResponse.status).toBe(200);

        const secondSubmitBody = (await secondSubmitResponse.json()) as {
          request_id?: string | null;
          decrypted?: number[];
          signature?: string;
          encryption_type?: number;
          error_message?: string | null;
          message?: string;
        };

        expect(secondSubmitBody.error_message ?? secondSubmitBody.message).toBeUndefined();
        expect(secondSubmitBody.request_id).toEqual(expect.any(String));
        expect(secondSubmitBody.request_id).not.toBe('');
        expect(secondSubmitBody.decrypted).toEqual(expect.any(Array));
        expect(secondSubmitBody.decrypted?.length).toBeGreaterThan(0);
        expect(secondSubmitBody.signature).toEqual(expect.any(String));
        expect(secondSubmitBody.signature).not.toBe('');
        expect(secondSubmitBody.encryption_type).toBe(FheTypes.Uint32);
      },
      180_000
    );
  });

  it('Decrypt for Tx (without acp) - should encrypt → store public → decryptForTx → publishDecryptResult → verify', async () => {
    const testValue = 42n;
    const [hash, signature] = await ctx.cofheClient
      .encryptInputs([Encryptable.uint32(testValue)])
      .setConsumingContract(ctx.contractAddress)
      .execute();

    const storeTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setPublicValueBatch',
      args: [[hash], signature],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    await ctx.publicClient.waitForTransactionReceipt({
      hash: storeTxHash,
      retryCount: 30,
      pollingInterval: 4_000,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    const ctHash = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'publicValueHash',
    });

    const decryptResult = await ctx.cofheClient.decryptForTx(ctHash).withoutACP().execute();

    expect(decryptResult.ctHash).toBe(ctHash);
    expect(decryptResult.decryptedValue).toBe(testValue);
    expect(decryptResult.signature).toBeDefined();

    const storedHandle = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'publicValue',
    });

    const publishTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'publishDecryptResult',
      args: [storedHandle, Number(decryptResult.decryptedValue), decryptResult.signature],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    await ctx.publicClient.waitForTransactionReceipt({
      hash: publishTxHash,
      retryCount: 30,
      pollingInterval: 4_000,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    const [publishedValue, isDecrypted] = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getDecryptResultSafe',
      args: [storedHandle],
    });

    expect(BigInt(publishedValue)).toBe(testValue);
    expect(isDecrypted).toBe(true);
  }, 180_000);

  // Bob stores a plain value and returns its handle.
  async function storeValue(value: bigint): Promise<`0x${string}`> {
    const hash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValueTrivial',
      args: [value],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    const { blockNumber } = await ctx.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    // Read at the receipt's block. A load-balanced RPC can answer "latest" from a node behind it.
    return (await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
      blockNumber,
    })) as `0x${string}`;
  }

  // An ACP's id is its creation time in seconds. Two ACPs by the same issuer in the same second
  // share an id, and revoking one revokes both. Call this before creating an ACP that will be
  // revoked, so the revoke cannot hit an ACP from the previous test.
  const waitForNextSecond = () => new Promise((resolve) => setTimeout(resolve, 1500));

  // The registry flow, end to end. Bob stores a value and posts a share of it for Alice on-chain,
  // labelled as the value getValueHash() returned at that block. Alice discovers the share, checks
  // the label against the chain, imports it, decrypts with it, and removes it. Dismissing is
  // Alice's transaction. On a testnet she has gas only when TEST_ALICE_PRIVATE_KEY is a funded
  // key, so otherwise Bob cancels the share instead.
  it('ACPs - on-chain share flow: share → discover → import → decrypt → dismiss', async () => {
    const testValue = 77n;

    // A chain without a sharing registry cannot run this. The client says so with MISSING_CONFIG.
    let incomingProbe: unknown;
    try {
      incomingProbe = await ctx.cofheClient.acp.getIncomingShares();
    } catch (e: any) {
      if (e?.code === 'MISSING_CONFIG') {
        console.warn(`[ACP SHARE] no sharingRegistry configured for ${chainConfig.label} — skipping`);
        return;
      }
      throw e;
    }
    expect(Array.isArray(incomingProbe)).toBe(true);

    // 1. Bob encrypts and stores a value
    const [encryptedHash, encryptedSignature] = await ctx.cofheClient
      .encryptInputs([Encryptable.uint32(testValue)])
      .setConsumingContract(ctx.contractAddress)
      .execute();
    const txHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValue',
      args: [encryptedHash, encryptedSignature],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    const { blockNumber } = await ctx.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    const ctHash = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
      blockNumber,
    });

    // 2. Bob shares that one value with Alice on-chain, labelled as where it came from
    const label = viewFunctionLabel({
      contract: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
      block: blockNumber,
    });
    const sharingACP = await ctx.cofheClient.acp.createSharing({
      issuer: ctx.bobAccount.address,
      recipient: ctx.aliceAccount.address,
      name: 'On-chain share to Alice',
      handles: [ctHash],
      labels: [label],
    });
    const { txHash: shareTx, shareId } = await ctx.cofheClient.acp.shareOnChain(sharingACP);
    expect(shareId).toMatch(/^0x[0-9a-f]{64}$/);
    await ctx.publicClient.waitForTransactionReceipt({
      hash: shareTx,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    // 3. Alice discovers the share, reads its label back, and imports it
    await ctx.cofheClient.connect(ctx.publicClient, ctx.aliceWalletClient);
    const incoming = await ctx.cofheClient.acp.getIncomingShares();
    const share = incoming.find((s) => s.shareId === shareId);
    expect(share).toBeDefined();
    expect(share!.issuer).toBe(ctx.bobAccount.address);
    expect(share!.handles).toEqual([ctHash]);
    expect(share!.metadata).toBe(encodeShareMetadata([label]));

    // The chain confirms the label: getValueHash() at that block returned the shared ctHash.
    expect(await ctx.cofheClient.acp.verifyShareLabels(share!)).toEqual(['verified']);
    const [described] = describeShareMetadata(share!, { [ctx.contractAddress]: simpleTestAbi })!;
    expect(described.kind === 'stored' && described.function?.name).toBe('getValueHash');

    const imported = await ctx.cofheClient.acp.importFromChain(share!);
    expect(imported.type).toBe('recipient');

    // 4. Alice decrypts Bob's value with the imported acp
    const value = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(value).toBe(BigInt(testValue));

    // 5. The share is removed. Anvil's Alice has gas. A generated testnet Alice has none.
    const aliceIsFunded = chainConfig.id === 31337 || TEST_ALICE_KEY_PROVIDED;
    if (!aliceIsFunded) await ctx.cofheClient.connect(ctx.publicClient, ctx.bobWalletClient);
    const removeTx = aliceIsFunded
      ? await ctx.cofheClient.acp.dismissShare(shareId)
      : await ctx.cofheClient.acp.cancelShare(shareId);
    await ctx.publicClient.waitForTransactionReceipt({
      hash: removeTx,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    if (!aliceIsFunded) await ctx.cofheClient.connect(ctx.publicClient, ctx.aliceWalletClient);
    const after = await ctx.cofheClient.acp.getIncomingShares();
    expect(after.find((s) => s.shareId === shareId)).toBeUndefined();

    // Back to Bob for the tests that follow.
    await ctx.cofheClient.connect(ctx.publicClient, ctx.bobWalletClient);
  }, 180_000);

  // `client.acp.checkAccess` returns an ACP's on-chain status as a value, where the ACL reverts.
  // Without a handle: 'valid', or why not. With a handle: 'allowed', 'out-of-scope' when the ACP
  // does not cover it, or 'issuer-not-allowed' when the issuer cannot read it either.
  it('ACPs - checkAccess reports the ACP and per-handle status instead of reverting', async () => {
    const acp = ctx.cofheClient.acp;
    const bob = ctx.bobAccount.address;
    const alice = ctx.aliceAccount.address;

    // Bob owns two values. A is shared below, B is not.
    const handleA = await storeValue(11n);
    const handleB = await storeValue(12n);

    await waitForNextSecond();
    const bobSelf = await acp.createSelf({ issuer: bob, name: 'Bob own' });
    expect(await acp.checkAccess(bobSelf)).toBe('valid');
    expect(await acp.checkAccess(bobSelf, handleA)).toBe('allowed');
    expect(await acp.checkAccess(bobSelf, BigInt(handleA))).toBe('allowed');

    // A SNAPSHOT share covering A only. The issuer copy has no recipient signature. Its status
    // still answers: expiry and revocation.
    const sharing = await acp.createSharing({ issuer: bob, recipient: alice, name: 'A only', handles: [handleA] });
    expect(await acp.checkAccess(sharing)).toBe('valid');

    await ctx.cofheClient.connect(ctx.publicClient, ctx.aliceWalletClient);
    try {
      const imported = await acp.importShared(acp.export(sharing), { activate: false });
      expect(await acp.checkAccess(imported)).toBe('valid');
      expect(await acp.checkAccess(imported, handleA)).toBe('allowed');
      expect(await acp.checkAccess(imported, handleB)).toBe('out-of-scope');

      // Alice's own ACP. She was never allowed on Bob's values.
      const aliceSelf = await acp.createSelf({ issuer: alice, name: 'Alice own' });
      expect(await acp.checkAccess(aliceSelf, handleA)).toBe('issuer-not-allowed');

      // Bob revokes the share. Every check on it now says so, with or without a handle.
      await ctx.cofheClient.connect(ctx.publicClient, ctx.bobWalletClient);
      const revokeTx = await acp.revokeACP(sharing);
      await ctx.publicClient.waitForTransactionReceipt({
        hash: revokeTx,
        confirmations: chainConfig.txConfirmationsRequired,
      });

      expect(await acp.checkAccess(sharing)).toBe('revoked');

      await ctx.cofheClient.connect(ctx.publicClient, ctx.aliceWalletClient);
      expect(await acp.checkAccess(imported)).toBe('revoked');
      expect(await acp.checkAccess(imported, handleA)).toBe('revoked');
    } finally {
      await ctx.cofheClient.connect(ctx.publicClient, ctx.bobWalletClient);
    }
  }, 180_000);

  // The minimal user flow with a revocable ACP. Bob stores a value, creates a contract-scoped ACP
  // (revocable through config.acp.defaultRevoker, no explicit options), decrypts with it, revokes
  // it on-chain, sees the decrypt fail, and gets access back with a fresh ACP.
  it('ACPs - a contract-scoped acp decrypts, stops after revoke, and a fresh one works again', async () => {
    const testValue = 42n;

    // 1. encrypt and store
    const [encryptedHash, encryptedSignature] = await ctx.cofheClient
      .encryptInputs([Encryptable.uint32(testValue)])
      .setConsumingContract(ctx.contractAddress)
      .execute();
    const txHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValue',
      args: [encryptedHash, encryptedSignature],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    const { blockNumber } = await ctx.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    const ctHash = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
      blockNumber,
    });

    // 2. a contract-scoped acp, revocable by default
    await waitForNextSecond();
    const acp = await ctx.cofheClient.acp.createSelf({
      issuer: ctx.bobAccount.address,
      name: 'Scoped revocable ACP',
      contracts: [ctx.contractAddress],
    });
    expect(acp.scope).toBe(1); // contract scope, derived from `contracts`
    expect(acp.revokerContract).not.toBe('0x0000000000000000000000000000000000000000');
    expect(acp.revokerData).toBeGreaterThan(0); // creation timestamp

    // 3. decrypt with it
    const value = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(value).toBe(BigInt(testValue));
    expect(await ctx.cofheClient.acp.isACPRevoked(acp)).toBe(false);

    // 4. revoke on-chain
    const revokeTx = await ctx.cofheClient.acp.revokeACP(acp);
    await ctx.publicClient.waitForTransactionReceipt({
      hash: revokeTx,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    expect(await ctx.cofheClient.acp.isACPRevoked(acp)).toBe(true);

    // 5. the revoked acp no longer decrypts. Each backend says so in its own way. The mocks pass
    //    the on-chain revert reason through. The testnet threshold network answers HTTP 401.
    //    Staging answers acp_denied.
    await expect(ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute()).rejects.toThrow(
      /PermissionInvalid_Disabled|acp_denied|HTTP 401/
    );

    // 6. a fresh acp restores access. It must not share the revoked one's id, so wait a second.
    await waitForNextSecond();
    await ctx.cofheClient.acp.createSelf({
      issuer: ctx.bobAccount.address,
      name: 'Scoped revocable ACP (fresh)',
      contracts: [ctx.contractAddress],
    });
    const valueAgain = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(valueAgain).toBe(BigInt(testValue));
  }, 180_000);
}
