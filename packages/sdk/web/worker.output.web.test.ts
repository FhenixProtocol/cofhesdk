import { arbSepolia as cofhesdkArbSepolia } from '@/chains';
import { Encryptable } from '@/core';

import { describe, it, expect, beforeAll } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofhesdkClient, createCofhesdkConfig } from './index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/sdk/web - Worker vs Main Thread Output Validation', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;

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
  });

  it('should produce consistent output format regardless of worker usage', async () => {
    // Create two clients - one with workers, one without
    const configWithWorker = createCofhesdkConfig({
      supportedChains: [cofhesdkArbSepolia],
      useWorkers: true,
    });

    const configWithoutWorker = createCofhesdkConfig({
      supportedChains: [cofhesdkArbSepolia],
      useWorkers: false,
    });

    const clientWithWorker = createCofhesdkClient(configWithWorker);
    const clientWithoutWorker = createCofhesdkClient(configWithoutWorker);

    await clientWithWorker.connect(publicClient, walletClient);
    await clientWithoutWorker.connect(publicClient, walletClient);

    const value = Encryptable.uint128(12345n);

    const [resultWithWorker, resultWithoutWorker] = await Promise.all([
      clientWithWorker.encryptInputs([value]).encrypt(),
      clientWithoutWorker.encryptInputs([value]).encrypt(),
    ]);

    // Both should succeed
    expect(resultWithWorker).toBeDefined();
    expect(resultWithoutWorker).toBeDefined();

    // Both should have same structure (but different encrypted values)
    const withWorker = resultWithWorker[0];
    const withoutWorker = resultWithoutWorker[0];

    expect(withWorker).toHaveProperty('ctHash');
    expect(withWorker).toHaveProperty('signature');
    expect(withWorker).toHaveProperty('utype');
    expect(withWorker).toHaveProperty('securityZone');
    expect(withoutWorker).toHaveProperty('ctHash');
    expect(withoutWorker).toHaveProperty('signature');
    expect(withoutWorker).toHaveProperty('utype');
    expect(withoutWorker).toHaveProperty('securityZone');

    // Format should be identical
    expect(typeof withWorker.ctHash).toBe('bigint');
    expect(typeof withoutWorker.ctHash).toBe('bigint');
    expect(withWorker.signature.startsWith('0x')).toBe(true);
    expect(withoutWorker.signature.startsWith('0x')).toBe(true);
    expect(typeof withWorker.utype).toBe('number');
    expect(typeof withoutWorker.utype).toBe('number');

    // Note: The actual encrypted values will differ because of randomness
    // in the encryption process, so we don't check equality
  }, 90000);
});
