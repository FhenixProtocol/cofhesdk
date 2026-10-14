import { describe, it, expect, beforeAll } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { describeShareMetadata, encodeShareMetadata, viewFunctionLabel } from '@cofhe/sdk/acps';
import { simpleTestAbi, TEST_ALICE_KEY_PROVIDED } from '@cofhe/test-setup';
import { ALL_CHAINS } from '../src/chains/index.js';
import { getMatrixChains } from '../src/matrix.js';
import type { ClientFactory, TestContext } from '../src/types.js';

/**
 * ACP on-chain sharing — the registry flow, end to end:
 *
 *   1. Bob encrypts + stores a value
 *   2. Bob creates a signed SNAPSHOT share of that value for Alice, labelled as the value
 *      `getValueHash()` returned at its block, and posts it (shareOnChain)
 *   3. Alice discovers it (getIncomingShares): the label reads back, checks against the chain
 *      and describes from the ABI; she imports it (importFromChain)
 *   4. Alice decrypts Bob's value with the imported acp
 *   5. Alice dismisses the share (or Bob cancels it, where Alice holds no gas)
 *
 * Chain-agnostic: runs wherever a registry is configured or served by the chain's ACL
 * (anvil deploys one; the testnets serve theirs; localcofhe via TEST_LOCALCOFHE_ACP_SHARE_REGISTRY).
 *
 * On a testnet Alice is TEST_ALICE_PRIVATE_KEY, or a key generated for the run (see
 * `@cofhe/test-setup`'s env.ts for why never a public one).
 */

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrix = getMatrixChains(process.env.MATRIX_ENV ?? '', process.env.MATRIX_CHAIN ?? '', ALL_CHAINS);
const enabledChains = matrix.filter(({ chainEnabled }) => chainEnabled).map(({ chain }) => chain);

describe.each(enabledChains)('[ACP SHARE] $label', (chainConfig) => {
  let ctx: TestContext;
  const testValue = 77n;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
  }, 120_000);

  it('on-chain share flow: share → discover → import → decrypt → dismiss', async () => {
    // Skip on chains without a configured registry (client throws MissingConfig)
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

    // 1. Bob (ctx default connection) encrypts + stores a value
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

    // the chain confirms the label: getValueHash() at that block returned the shared ctHash
    expect(await ctx.cofheClient.acp.verifyShareLabels(share!)).toEqual(['verified']);
    const [described] = describeShareMetadata(share!, { [ctx.contractAddress]: simpleTestAbi })!;
    expect(described.kind === 'stored' && described.function?.name).toBe('getValueHash');

    const imported = await ctx.cofheClient.acp.importFromChain(share!);
    expect(imported.type).toBe('recipient');

    // 4. Alice decrypts Bob's value with the imported acp
    const value = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(value).toBe(BigInt(testValue));

    // 5. The share is removed. Dismissing is Alice's transaction, so it needs a funded Alice: Anvil's
    //    is, and on a testnet one given as TEST_ALICE_PRIVATE_KEY is (a generated one holds no gas).
    //    Otherwise Bob cancels it, which also leaves the registry clean for the next run.
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

    // reconnect as Bob for any following suites
    await ctx.cofheClient.connect(ctx.publicClient, ctx.bobWalletClient);
  }, 180_000);
});
