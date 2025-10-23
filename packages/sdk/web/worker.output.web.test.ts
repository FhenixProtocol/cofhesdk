import { arbSepolia as cofhesdkArbSepolia } from '@/chains';
import { Encryptable, type CofhesdkClient } from '@/core';

import { describe, it, expect, beforeAll } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofhesdkClient, createCofhesdkConfig } from './index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhesdk/web - Worker vs Main Thread Output Validation', () => {
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

  const testCases = [
    { name: 'uint8', encryptable: Encryptable.uint8(42n) },
    { name: 'uint16', encryptable: Encryptable.uint16(1000n) },
    { name: 'uint32', encryptable: Encryptable.uint32(100000n) },
    { name: 'uint64', encryptable: Encryptable.uint64(1000000n) },
    { name: 'uint128', encryptable: Encryptable.uint128(10000000000n) },
    // uint256 is disabled: [U256-DISABLED]
    // { name: 'uint256', encryptable: Encryptable.uint256(100000000000000n) },
    { name: 'bool true', encryptable: Encryptable.bool(true) },
    { name: 'bool false', encryptable: Encryptable.bool(false) },
    { name: 'address', encryptable: Encryptable.address('0x1234567890123456789012345678901234567890') },
  ];

  for (const testCase of testCases) {
    it(`should produce valid encrypted output for ${testCase.name} (main thread)`, async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false, // Force main thread
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      const result = await client
        .encryptInputs([testCase.encryptable])
        .encrypt();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);

      const [encrypted] = result.data!;
      expect(encrypted).toHaveProperty('ctHash');
      expect(encrypted).toHaveProperty('signature');
      expect(encrypted).toHaveProperty('utype');
      expect(encrypted).toHaveProperty('securityZone');
      expect(typeof encrypted.ctHash).toBe('bigint');
      expect(typeof encrypted.signature).toBe('string');
      expect(encrypted.signature.startsWith('0x')).toBe(true);
      expect(typeof encrypted.utype).toBe('number');
      expect(typeof encrypted.securityZone).toBe('number');
    }, 60000);
  }

  it('should encrypt multiple different types correctly (main thread)', async () => {
    const config = createCofhesdkConfig({
      supportedChains: [cofhesdkArbSepolia],
      useWorkers: false,
    });

    const client = createCofhesdkClient(config);
    await client.connect(publicClient, walletClient);

    const result = await client
      .encryptInputs([
        Encryptable.uint8(1n),
        Encryptable.uint16(2n),
        Encryptable.uint32(3n),
        Encryptable.uint64(4n),
        Encryptable.bool(true),
      ])
      .encrypt();

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(5);

    // All should have valid encryption data
    result.data?.forEach((encrypted) => {
      expect(encrypted.signature.startsWith('0x')).toBe(true);
      expect(encrypted.signature.length).toBeGreaterThan(2);
      expect(typeof encrypted.ctHash).toBe('bigint');
      expect(typeof encrypted.utype).toBe('number');
      expect(typeof encrypted.securityZone).toBe('number');
    });
  }, 60000);

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
    expect(resultWithWorker.success).toBe(true);
    expect(resultWithoutWorker.success).toBe(true);

    // Both should have same structure (but different encrypted values)
    const withWorker = resultWithWorker.data![0];
    const withoutWorker = resultWithoutWorker.data![0];

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

