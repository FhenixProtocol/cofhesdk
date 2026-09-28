import { describe, expect, it } from 'vitest';
import type { useCofheWriteContract } from './useCofheWriteContract';

/**
 * Type-level: the write the hook accepts needs neither `chain` nor `account` — both come from the
 * connected wallet — while the ABI still types `functionName` and `args`. `tsc` over the test
 * tree (`check:types`) is the assertion; the runtime `it` only keeps vitest from reporting an
 * empty file.
 */

const MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const TOKEN = '0x00000000000000000000000000000000000000A1';

type WriteContractAsync = ReturnType<typeof useCofheWriteContract>['writeContractAsync'];

async function typeOnly(writeContractAsync: WriteContractAsync) {
  // The plain call: address, abi, functionName, args — nothing about the wallet.
  await writeContractAsync({ address: TOKEN, abi: MINT_ABI, functionName: 'mint', args: [TOKEN, 1n] });

  // The same shape under `writeContractInput` when extras ride along.
  await writeContractAsync({
    writeContractInput: { address: TOKEN, abi: MINT_ABI, functionName: 'mint', args: [TOKEN, 1n] },
    extras: undefined,
  });

  // Explicit wallet details stay accepted.
  await writeContractAsync({
    address: TOKEN,
    abi: MINT_ABI,
    functionName: 'mint',
    args: [TOKEN, 1n],
    account: TOKEN,
    chain: null,
  });

  // ...and the ABI still checks the call — the point of not casting `as never`.
  await writeContractAsync({
    address: TOKEN,
    abi: MINT_ABI,
    functionName: 'mint',
    // @ts-expect-error — amount is a uint256, so a bigint, not a number
    args: [TOKEN, 1],
  });
}

describe('useCofheWriteContract params', () => {
  it('need neither chain nor account (type-level; see typeOnly above)', () => {
    expect(typeof typeOnly).toBe('function');
  });
});
