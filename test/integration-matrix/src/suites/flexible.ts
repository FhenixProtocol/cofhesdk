/**
 * Flexible test suite — scratch pad for in-progress feature development.
 *
 * Add tests here freely while building a feature. Once the feature is stable
 * and the behaviour should be guaranteed across all chains, move the tests
 * to inherited.ts instead.
 *
 * NOTE: Must not use process.env in this file.
 */

import { it, expect, beforeAll, afterAll } from 'vitest';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { localcofhe } from '@cofhe/sdk/chains';
import { PermitUtils, type Permission } from '@cofhe/sdk/permits';
import { simpleTestAbi } from '@cofhe/test-setup';
import type { TestChainConfig, ClientFactory, TestContext } from '../types.js';

function makeThresholdRequestBody(ctHash: bigint | string, permission: Permission) {
  return {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: localcofhe.id,
    permit: permission,
  };
}

export function runFlexibleSuite(chainConfig: TestChainConfig, factory: ClientFactory) {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
  }, 60_000);

  afterAll(async () => {
    await chainConfig.teardown?.();
  });

  if (chainConfig.id !== 420105) {
    it.skip('Should encrypt -> store -> on-chain FHE op -> decryptForView -> on-chain FHE op -> decryptForTx -> publish -> verify', () => {});
    return;
  }

  it('Should encrypt -> store -> on-chain FHE op -> decryptForView -> on-chain FHE op -> decryptForTx -> publish -> verify', async () => {
    await ctx.cofheClient.permits.createSelf({
      issuer: ctx.bobAccount.address,
      name: 'Local CoFHE Flexible Permit',
    });

    const testValue = 101n;
    const valueToAdd = 7n;
    const secondValueToAdd = 11n;
    const expectedViewValue = testValue + valueToAdd;
    const expectedTxValue = expectedViewValue + secondValueToAdd;

    const encrypted = await ctx.cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
    const encryptedInput = { ...encrypted[0], signature: encrypted[0].signature as `0x${string}` };

    const storeTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValue',
      args: [encryptedInput],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    await ctx.publicClient.waitForTransactionReceipt({
      hash: storeTxHash,
      retryCount: 30,
      pollingInterval: 4_000,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    const encryptedAddend = await ctx.cofheClient.encryptInputs([Encryptable.uint32(valueToAdd)]).execute();
    const encryptedAddendInput = { ...encryptedAddend[0], signature: encryptedAddend[0].signature as `0x${string}` };

    const addTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'addValue',
      args: [encryptedAddendInput],
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

    const encryptedSecondAddend = await ctx.cofheClient.encryptInputs([Encryptable.uint32(secondValueToAdd)]).execute();
    const encryptedSecondAddendInput = {
      ...encryptedSecondAddend[0],
      signature: encryptedSecondAddend[0].signature as `0x${string}`,
    };

    const secondAddTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'addValue',
      args: [encryptedSecondAddendInput],
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

    const decryptResult = await ctx.cofheClient.decryptForTx(updatedCtHash).withPermit().execute();

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

  it('Should return a cached completed payload when requesting an already decrypted decryption again', async () => {
    await ctx.cofheClient.permits.createSelf({
      issuer: ctx.bobAccount.address,
      name: 'Local CoFHE Cached Decrypt Permit',
    });

    const testValue = 73n;
    const valueToAdd = 19n;
    const expectedValue = testValue + valueToAdd;

    const encrypted = await ctx.cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();
    const encryptedInput = { ...encrypted[0], signature: encrypted[0].signature as `0x${string}` };

    const storeTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'setValue',
      args: [encryptedInput],
      chain: chainConfig.viemChain,
      account: ctx.bobAccount,
    });
    await ctx.publicClient.waitForTransactionReceipt({
      hash: storeTxHash,
      retryCount: 30,
      pollingInterval: 4_000,
      confirmations: chainConfig.txConfirmationsRequired,
    });

    const encryptedAddend = await ctx.cofheClient.encryptInputs([Encryptable.uint32(valueToAdd)]).execute();
    const encryptedAddendInput = { ...encryptedAddend[0], signature: encryptedAddend[0].signature as `0x${string}` };

    const addTxHash = await ctx.bobWalletClient.writeContract({
      address: ctx.contractAddress,
      abi: simpleTestAbi,
      functionName: 'addValue',
      args: [encryptedAddendInput],
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

    const firstDecryptResult = await ctx.cofheClient.decryptForTx(ctHash).withPermit().execute();

    expect(firstDecryptResult.ctHash).toBe(ctHash);
    expect(firstDecryptResult.decryptedValue).toBe(expectedValue);

    const activePermit = ctx.cofheClient.permits.getActivePermit();
    expect(activePermit).toBeDefined();

    const secondSubmitResponse = await fetch(`${localcofhe.thresholdNetworkUrl}/v2/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(makeThresholdRequestBody(ctHash, PermitUtils.getPermission(activePermit!, true))),
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
  }, 180_000);
}
