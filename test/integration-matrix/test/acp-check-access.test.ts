import { describe, it, expect, beforeAll } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { simpleTestAbi } from '@cofhe/test-setup';
import { ALL_CHAINS } from '../src/chains/index.js';
import { getMatrixChains } from '../src/matrix.js';
import type { ClientFactory, TestChainConfig, TestContext } from '../src/types.js';

/**
 * `client.acp.checkAccess`: an ACP on-chain status as a value, where the ACL itself reverts.
 *
 *   - without a handle: 'valid', or why not (here: 'revoked')
 *   - with a handle: 'allowed', 'out-of-scope' (the ACP does not cover it) or
 *     'issuer-not-allowed' (the issuer cannot read it either)
 */

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrix = getMatrixChains(process.env.MATRIX_ENV ?? '', process.env.MATRIX_CHAIN ?? '', ALL_CHAINS);
const enabledChains = matrix.filter(({ chainEnabled }) => chainEnabled).map(({ chain }) => chain);

async function storeValue(ctx: TestContext, chainConfig: TestChainConfig, value: bigint): Promise<`0x${string}`> {
  const hash = await ctx.bobWalletClient.writeContract({
    address: ctx.contractAddress,
    abi: simpleTestAbi,
    functionName: 'setValueTrivial',
    args: [value],
    chain: chainConfig.viemChain,
    account: ctx.bobAccount,
  });
  await ctx.publicClient.waitForTransactionReceipt({ hash, confirmations: chainConfig.txConfirmationsRequired });
  return (await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: simpleTestAbi,
    functionName: 'getValueHash',
  })) as `0x${string}`;
}

describe.each(enabledChains)('[ACP CHECK ACCESS] $label', (chainConfig) => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
  }, 120_000);

  it('reports ACP and per-handle status instead of reverting', async () => {
    const acp = ctx.cofheClient.acp;
    const bob = ctx.bobAccount.address;
    const alice = ctx.aliceAccount.address;

    // Bob owns two values: A is shared below, B is not.
    const handleA = await storeValue(ctx, chainConfig, 11n);
    const handleB = await storeValue(ctx, chainConfig, 12n);

    const bobSelf = await acp.createSelf({ issuer: bob, name: 'Bob own' });
    expect(await acp.checkAccess(bobSelf)).toBe('valid');
    expect(await acp.checkAccess(bobSelf, handleA)).toBe('allowed');
    expect(await acp.checkAccess(bobSelf, BigInt(handleA))).toBe('allowed');

    // A SNAPSHOT share covering A only. The issuer copy has no recipient signature; its status
    // still answers: expiry and revocation.
    const sharing = await acp.createSharing({ issuer: bob, recipient: alice, name: 'A only', handles: [handleA] });
    expect(await acp.checkAccess(sharing)).toBe('valid');

    await ctx.cofheClient.connect(ctx.publicClient, ctx.aliceWalletClient);
    try {
      const imported = await acp.importShared(acp.export(sharing), { activate: false });
      expect(await acp.checkAccess(imported)).toBe('valid');
      expect(await acp.checkAccess(imported, handleA)).toBe('allowed');
      expect(await acp.checkAccess(imported, handleB)).toBe('out-of-scope');

      // Alice own ACP: she was never allowed on Bob values.
      const aliceSelf = await acp.createSelf({ issuer: alice, name: 'Alice own' });
      expect(await acp.checkAccess(aliceSelf, handleA)).toBe('issuer-not-allowed');

      // Bob revokes the share: every check on it now says so, with or without a handle.
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
});
