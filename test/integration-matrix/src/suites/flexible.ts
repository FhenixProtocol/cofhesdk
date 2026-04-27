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
import { simpleTestAbi } from '@cofhe/test-setup';
import type { TestChainConfig, ClientFactory, TestContext } from '../types.js';

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
}
