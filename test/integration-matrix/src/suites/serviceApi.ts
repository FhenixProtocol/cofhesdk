/**
 * Service API tests: the SDK against the real CoFHE services (teecryptor, zee-k-verifier).
 *
 * The unit tests mock the service responses. These run against a live stack, so a service that
 * changes its status codes or error body breaks here before it breaks users.
 *
 * NOTE: Must not use process.env in this file.
 */

import { it, describe, expect, beforeAll } from 'vitest';
import { CofheErrorCode, Encryptable, FheTypes } from '@cofhe/sdk';
import { ACPUtils, type ACP } from '@cofhe/sdk/acps';
import { simpleTestAbi } from '@cofhe/test-setup';
import type { TestChainConfig, ClientFactory, TestContext } from '../types.js';

const STORED_VALUE = 42n;
const EXPIRED_SECONDS_AGO = 3_600;

async function expectDecryptRejection(
  ctx: TestContext,
  ctHash: `0x${string}`,
  acp: ACP,
  expected: { code: CofheErrorCode; apiErrorCode: string }
) {
  const error = await ctx.cofheClient
    .decryptForView(ctHash, FheTypes.Uint32)
    .withACP(acp)
    .execute()
    .then(
      () => undefined,
      (e: unknown) => e
    );

  expect(error).toMatchObject(expected);
}

export function runServiceApiSuite(chainConfig: TestChainConfig, factory: ClientFactory) {
  let ctx: TestContext;
  let ctHash: `0x${string}`;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);

    const [hash, signature] = await ctx.cofheClient
      .encryptInputs([Encryptable.uint32(STORED_VALUE)])
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
    const { blockNumber } = await ctx.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    ctHash = await ctx.publicClient.readContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'getValueHash',
      blockNumber,
    });
  }, 180_000);

  describe('teecryptor 401', () => {
    it('maps acp_denied to ACP_DENIED for an acp whose issuer the ACL does not allow on the handle', async () => {
      const aliceACP = await ctx.cofheClient.acp.createSelf(
        { issuer: ctx.aliceAccount.address, name: 'Alice ACP (not allowed)' },
        { publicClient: ctx.publicClient, walletClient: ctx.aliceWalletClient }
      );

      await expectDecryptRejection(ctx, ctHash, aliceACP, {
        code: CofheErrorCode.ACPDenied,
        apiErrorCode: 'acp_denied',
      });
    }, 60_000);

    // The SDK refuses an expired acp before sending it, so only clock skew lets one reach
    // teecryptor. Post it directly to pin the response the SDK's acp_expired mapping expects.
    it('answers 401 acp_expired for a signed acp past its expiration', async () => {
      const { timestamp } = await ctx.publicClient.getBlock();
      const expiredACP = await ctx.cofheClient.acp.createSelf({
        issuer: ctx.bobAccount.address,
        name: 'Expired ACP',
        expiration: Number(timestamp) - EXPIRED_SECONDS_AGO,
      });

      const response = await fetch(`${chainConfig.cofheChain.thresholdNetworkUrl}/v2/sealoutput`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
          host_chain_id: chainConfig.cofheChain.id,
          acp: ACPUtils.getPublic(expiredACP, true),
        }),
      });

      expect({ status: response.status, body: await response.json() }).toMatchObject({
        status: 401,
        body: { error: 'acp_expired' },
      });
    }, 60_000);

    it('maps acp_invalid to ACP_INVALID for an acp carrying another acp signature', async () => {
      const validACP = await ctx.cofheClient.acp.createSelf({ issuer: ctx.bobAccount.address, name: 'Valid ACP' });
      const otherACP = await ctx.cofheClient.acp.createSelf({
        issuer: ctx.bobAccount.address,
        name: 'Signature donor ACP',
        expiration: validACP.expiration - 1,
      });
      // A well-formed signature from the right key over different fields: teecryptor must answer
      // acp_invalid, not acp_malformed.
      const forgedACP = { ...validACP, issuerSignature: otherACP.issuerSignature };

      await expectDecryptRejection(ctx, ctHash, forgedACP, {
        code: CofheErrorCode.ACPInvalid,
        apiErrorCode: 'acp_invalid',
      });
    }, 60_000);
  });
}
