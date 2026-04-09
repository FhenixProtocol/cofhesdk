import assert from 'node:assert/strict';
import type { PublicClient } from 'viem';

export const hasCode = async (publicClient: Pick<PublicClient, 'getCode'>, address: `0x${string}`) => {
  const code = await publicClient.getCode({ address });
  return !!code && code.length > 2;
};

export const getErrorText = (err: unknown) => {
  if (err && typeof err === 'object') {
    const error = err as {
      shortMessage?: string;
      message?: string;
      details?: string;
      cause?: unknown;
    };

    return [
      error.shortMessage,
      error.message,
      error.details,
      error.cause ? String(error.cause) : undefined,
      String(err),
    ]
      .filter(Boolean)
      .join('\n');
  }

  return String(err);
};

export const expectRevert = async (fn: () => Promise<unknown>, pattern: RegExp) => {
  await assert.rejects(fn, (err) => {
    assert.match(getErrorText(err), pattern);
    return true;
  });
};
