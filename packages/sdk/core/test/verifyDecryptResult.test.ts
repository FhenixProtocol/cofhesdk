import { describe, expect, it, vi } from 'vitest';
import { zeroAddress, type Hex, type PublicClient } from 'viem';
import { verifyDecryptResult } from '../decrypt/verifyDecryptResult.js';

describe('verifyDecryptResult', () => {
  it('returns false when the configured signer is the zero address', async () => {
    const publicClient = {
      chain: { id: 31337 },
      readContract: vi.fn().mockResolvedValue(zeroAddress),
    } as unknown as PublicClient;

    const isValid = await verifyDecryptResult(123n, 456n, '0xdeadbeef' as Hex, publicClient);

    expect(isValid).toBe(false);
  });
});
