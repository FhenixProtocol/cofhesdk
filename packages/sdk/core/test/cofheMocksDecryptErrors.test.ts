import { describe, it, expect } from 'vitest';
import { decodeFunctionData, encodeFunctionResult } from 'viem';
import { createMockACP } from '../../acps/test-utils.js';
import { cofheMocksDecryptForView } from '../decrypt/cofheMocksDecryptForView.js';
import { cofheMocksDecryptForTx } from '../decrypt/cofheMocksDecryptForTx.js';
import { CofheErrorCode } from '../error.js';
import { FheTypes } from '../types.js';
import { MockThresholdNetworkAbi } from '../decrypt/MockThresholdNetworkAbi.js';
import { fakeMocksNode } from './fakeMocksNode.js';

const EMPTY_SEALED = `0x${'00'.repeat(32)}` as const;

// Reasons MockThresholdNetwork reports for a rejected ACP, and the code the threshold network
// answers the same case with.
const ACP_REJECTIONS = [
  { reason: 'NotAllowed', code: CofheErrorCode.ACPDenied, apiErrorCode: 'acp_denied' },
  { reason: 'PermissionInvalid_Disabled', code: CofheErrorCode.ACPDenied, apiErrorCode: 'acp_denied' },
  { reason: 'PermissionInvalid_Expired', code: CofheErrorCode.ACPExpired, apiErrorCode: 'acp_expired' },
  { reason: 'PermissionInvalid_IssuerSignature', code: CofheErrorCode.ACPInvalid, apiErrorCode: 'acp_invalid' },
  { reason: 'PermissionInvalid_RecipientSignature', code: CofheErrorCode.ACPInvalid, apiErrorCode: 'acp_invalid' },
];

// A mocks request function whose MockThresholdNetwork answers every query with `result`
const requestFnReturning = (result: readonly [boolean, string, bigint | `0x${string}`]) =>
  fakeMocksNode((data) => {
    const { functionName } = decodeFunctionData({ abi: MockThresholdNetworkAbi, data });
    return encodeFunctionResult({ abi: MockThresholdNetworkAbi, functionName, result: result as any });
  }).request;

describe('mocks decryptForView errors', () => {
  it.each(ACP_REJECTIONS)('maps $reason to $apiErrorCode', async ({ reason, code, apiErrorCode }) => {
    const requestFn = requestFnReturning([false, reason, EMPTY_SEALED]);

    await expect(cofheMocksDecryptForView(1n, FheTypes.Uint32, await createMockACP(), requestFn)).rejects.toMatchObject(
      {
        code,
        apiErrorCode,
        message: expect.stringContaining(reason),
      }
    );
  });

  it('keeps SealOutputFailed for a reason the threshold network has no code for', async () => {
    const requestFn = requestFnReturning([false, 'Low Level Error', EMPTY_SEALED]);

    await expect(cofheMocksDecryptForView(1n, FheTypes.Uint32, await createMockACP(), requestFn)).rejects.toMatchObject(
      {
        code: CofheErrorCode.SealOutputFailed,
        apiErrorCode: undefined,
      }
    );
  });
});

describe('mocks decryptForTx errors', () => {
  it.each(ACP_REJECTIONS)('with an ACP, maps $reason to $apiErrorCode', async ({ reason, code, apiErrorCode }) => {
    const requestFn = requestFnReturning([false, reason, 0n]);

    await expect(cofheMocksDecryptForTx(1n, FheTypes.Uint32, await createMockACP(), requestFn)).rejects.toMatchObject({
      code,
      apiErrorCode,
      message: expect.stringContaining(reason),
    });
  });

  it('without an ACP, maps NotAllowed to not_publicly_allowed', async () => {
    const requestFn = requestFnReturning([false, 'NotAllowed', 0n]);

    await expect(cofheMocksDecryptForTx(1n, FheTypes.Uint32, null, requestFn)).rejects.toMatchObject({
      code: CofheErrorCode.NotPubliclyAllowed,
      apiErrorCode: 'not_publicly_allowed',
    });
  });

  it('keeps DecryptFailed for a reason the threshold network has no code for', async () => {
    const requestFn = requestFnReturning([false, 'Panic', 0n]);

    await expect(cofheMocksDecryptForTx(1n, FheTypes.Uint32, null, requestFn)).rejects.toMatchObject({
      code: CofheErrorCode.DecryptFailed,
      apiErrorCode: undefined,
    });
  });
});
