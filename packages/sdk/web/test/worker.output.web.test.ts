import { arbSepolia as cofheArbSepolia } from '@/chains';
import { Encryptable } from '@/core';

import { describe, it, expect, beforeAll } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from '../index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/sdk/web - Worker vs Main Thread Output Validation', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let consumingContract: `0x${string}`;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: viemArbitrumSepolia,
      transport: http(),
    });

    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    walletClient = createWalletClient({
      chain: viemArbitrumSepolia,
      transport: http(),
      account,
    });
    consumingContract = account.address;
  });

  it('should produce consistent output format regardless of worker usage', async () => {
    // Create two clients - one with workers, one without
    const configWithWorker = createCofheConfig({
      supportedChains: [cofheArbSepolia],
      useWorkers: true,
    });

    const configWithoutWorker = createCofheConfig({
      supportedChains: [cofheArbSepolia],
      useWorkers: false,
    });

    const clientWithWorker = createCofheClient(configWithWorker);
    const clientWithoutWorker = createCofheClient(configWithoutWorker);

    await clientWithWorker.connect(publicClient, walletClient);
    await clientWithoutWorker.connect(publicClient, walletClient);

    const value = Encryptable.uint128(12345n);

    const [resultWithWorker, resultWithoutWorker] = await Promise.all([
      clientWithWorker.encryptInputs([value]).setConsumingContract(consumingContract).execute(),
      clientWithoutWorker.encryptInputs([value]).setConsumingContract(consumingContract).execute(),
    ]);

    // Both should succeed
    expect(resultWithWorker).toBeDefined();
    expect(resultWithoutWorker).toBeDefined();

    // Both should have same structure (but different encrypted values):
    // [hash, signature] - one hash per input, followed by the shared batch signature.
    expect(resultWithWorker.length).toBe(2);
    expect(resultWithoutWorker.length).toBe(2);

    const [hashWithWorker, signatureWithWorker] = resultWithWorker;
    const [hashWithoutWorker, signatureWithoutWorker] = resultWithoutWorker;

    // Format should be identical
    expect(typeof hashWithWorker).toBe('string');
    expect(typeof hashWithoutWorker).toBe('string');
    expect(hashWithWorker.startsWith('0x')).toBe(true);
    expect(hashWithoutWorker.startsWith('0x')).toBe(true);
    expect(signatureWithWorker.startsWith('0x')).toBe(true);
    expect(signatureWithoutWorker.startsWith('0x')).toBe(true);

    // Note: The actual encrypted values will differ because of randomness
    // in the encryption process, so we don't check equality
  }, 90000);
});
