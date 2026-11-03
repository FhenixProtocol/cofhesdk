import { describe, it, expect, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createMockACP } from '../../acps/test-utils.js';
import { cofheMocksDecryptForView } from '../decrypt/cofheMocksDecryptForView.js';
import { cofheMocksDecryptForTx } from '../decrypt/cofheMocksDecryptForTx.js';
import { CofheErrorCode } from '../error.js';
import { FheTypes } from '../types.js';

// Reasons MockThresholdNetwork reports for a rejected ACP, and the code the threshold network
// answers the same case with.
const ACP_REJECTIONS = [
  { reason: 'NotAllowed', code: CofheErrorCode.ACPDenied, apiErrorCode: 'acp_denied' },
  { reason: 'PermissionInvalid_Disabled', code: CofheErrorCode.ACPDenied, apiErrorCode: 'acp_denied' },
  { reason: 'PermissionInvalid_Expired', code: CofheErrorCode.ACPExpired, apiErrorCode: 'acp_expired' },
  { reason: 'PermissionInvalid_IssuerSignature', code: CofheErrorCode.ACPInvalid, apiErrorCode: 'acp_invalid' },
  { reason: 'PermissionInvalid_RecipientSignature', code: CofheErrorCode.ACPInvalid, apiErrorCode: 'acp_invalid' },
];

const publicClientReturning = (result: readonly [boolean, string, bigint | `0x${string}`]) =>
  ({ chain: { id: 31337 }, readContract: vi.fn(async () => result) }) as unknown as PublicClient;

describe('mocks decryptForView errors', () => {
  it.each(ACP_REJECTIONS)('maps $reason to $apiErrorCode', async ({ reason, code, apiErrorCode }) => {
    const publicClient = publicClientReturning([false, reason, '0x00']);

    await expect(
      cofheMocksDecryptForView(1n, FheTypes.Uint32, await createMockACP(), publicClient)
    ).rejects.toMatchObject({
      code,
      apiErrorCode,
      message: expect.stringContaining(reason),
    });
  });

  it('keeps SealOutputFailed for a reason the threshold network has no code for', async () => {
    const publicClient = publicClientReturning([false, 'Low Level Error', '0x00']);

    await expect(
      cofheMocksDecryptForView(1n, FheTypes.Uint32, await createMockACP(), publicClient)
    ).rejects.toMatchObject({
      code: CofheErrorCode.SealOutputFailed,
      apiErrorCode: undefined,
    });
  });
});

describe('mocks decryptForTx errors', () => {
  it.each(ACP_REJECTIONS)('with an ACP, maps $reason to $apiErrorCode', async ({ reason, code, apiErrorCode }) => {
    const publicClient = publicClientReturning([false, reason, 0n]);

    await expect(
      cofheMocksDecryptForTx(1n, FheTypes.Uint32, await createMockACP(), publicClient)
    ).rejects.toMatchObject({
      code,
      apiErrorCode,
      message: expect.stringContaining(reason),
    });
  });

  it('without an ACP, maps NotAllowed to not_publicly_allowed', async () => {
    const publicClient = publicClientReturning([false, 'NotAllowed', 0n]);

    await expect(cofheMocksDecryptForTx(1n, FheTypes.Uint32, null, publicClient)).rejects.toMatchObject({
      code: CofheErrorCode.NotPubliclyAllowed,
      apiErrorCode: 'not_publicly_allowed',
    });
  });

  it('keeps DecryptFailed for a reason the threshold network has no code for', async () => {
    const publicClient = publicClientReturning([false, 'Panic', 0n]);

    await expect(cofheMocksDecryptForTx(1n, FheTypes.Uint32, null, publicClient)).rejects.toMatchObject({
      code: CofheErrorCode.DecryptFailed,
      apiErrorCode: undefined,
    });
  });
});
