import { describe, it, expect, beforeAll } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { simpleTestAbi } from '@cofhe/test-setup';
import { ALL_CHAINS } from '../src/chains/index.js';
import { getMatrixChains } from '../src/matrix.js';
import type { ClientFactory, TestContext } from '../src/types.js';

/**
 * ACP on-chain sharing — the registry flow, end to end:
 *
 *   1. Bob encrypts + stores a value
 *   2. Bob creates a signed sharing ACP for Alice and posts it (shareOnChain)
 *   3. Alice discovers it (getIncomingShares) and imports it (importFromChain)
 *   4. Alice decrypts Bob's value with the imported permit
 *   5. Alice dismisses the share
 *
 * Chain-agnostic: runs wherever the chain setup provides a sharingRegistry
 * (anvil deploys one; localcofhe via TEST_LOCALCOFHE_ACP_SHARE_REGISTRY).
 */

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrix = getMatrixChains(process.env.MATRIX_ENV ?? '', process.env.MATRIX_CHAIN ?? '', ALL_CHAINS);
const enabledChains = matrix.filter(({ chainEnabled }) => chainEnabled).map(({ chain }) => chain);

describe.each(enabledChains)('[ACP SHARE] $label', (chainConfig) => {
  let ctx: TestContext;
  const testValue = 77;

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
    const encrypted = await ctx.cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
    const txHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValue',
      args: [encrypted[0]],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    await ctx.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    const ctHash = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
    });

    // 2. Bob shares with Alice on-chain
    const sharingPermit = await ctx.cofheClient.acp.createSharing({
      issuer: ctx.bobAccount.address,
      recipient: ctx.aliceAccount.address,
      name: 'On-chain share to Alice',
    });
    const { txHash: shareTx, shareId } = await ctx.cofheClient.acp.shareOnChain(sharingPermit);
    expect(shareId).toMatch(/^0x[0-9a-f]{64}$/);
    await ctx.publicClient.waitForTransactionReceipt({
      hash: shareTx,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    // 3. Alice discovers and imports
    await ctx.cofheClient.connect(ctx.publicClient, ctx.aliceWalletClient);
    const incoming = await ctx.cofheClient.acp.getIncomingShares();
    const share = incoming.find((s) => s.shareId === shareId);
    expect(share).toBeDefined();
    expect(share!.issuer).toBe(ctx.bobAccount.address);

    const imported = await ctx.cofheClient.acp.importFromChain(share!);
    expect(imported.type).toBe('recipient');

    // 4. Alice decrypts Bob's value with the imported permit
    const value = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(value).toBe(BigInt(testValue));

    // 5. Alice dismisses the share
    const dismissTx = await ctx.cofheClient.acp.dismissShare(shareId);
    await ctx.publicClient.waitForTransactionReceipt({
      hash: dismissTx,
      confirmations: chainConfig.txConfirmationsRequired,
    });
    const after = await ctx.cofheClient.acp.getIncomingShares();
    expect(after.find((s) => s.shareId === shareId)).toBeUndefined();

    // reconnect as Bob for any following suites
    await ctx.cofheClient.connect(ctx.publicClient, ctx.bobWalletClient);
  }, 180_000);
});
