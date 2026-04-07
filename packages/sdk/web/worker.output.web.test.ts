import { Encryptable } from '@/core';

import { describe, it, expect, beforeAll } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from './index.js';
import { selectedTestNetwork } from '../testNetwork.js';

describe('@cofhe/sdk/web - Worker vs Main Thread Output Validation', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: selectedTestNetwork.viemChain,
      transport: http(selectedTestNetwork.rpcUrl),
    });

    const account = privateKeyToAccount(selectedTestNetwork.privateKey);
    walletClient = createWalletClient({
      chain: selectedTestNetwork.viemChain,
      transport: http(selectedTestNetwork.rpcUrl),
      account,
    });
  });

  it('should produce consistent output format regardless of worker usage', async () => {
    // Create two clients - one with workers, one without
    const configWithWorker = createCofheConfig({
      supportedChains: [selectedTestNetwork.sdkChain],
      useWorkers: true,
    });

    const configWithoutWorker = createCofheConfig({
      supportedChains: [selectedTestNetwork.sdkChain],
      useWorkers: false,
    });

    const clientWithWorker = createCofheClient(configWithWorker);
    const clientWithoutWorker = createCofheClient(configWithoutWorker);

    await clientWithWorker.connect(publicClient, walletClient);
    await clientWithoutWorker.connect(publicClient, walletClient);

    const value = Encryptable.uint128(12345n);

    const [resultWithWorker, resultWithoutWorker] = await Promise.all([
      clientWithWorker.encryptInputs([value]).execute(),
      clientWithoutWorker.encryptInputs([value]).execute(),
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
