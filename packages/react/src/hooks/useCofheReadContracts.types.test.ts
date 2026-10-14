import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Abi } from 'viem';
import type { useCofheReadContracts } from './useCofheReadContracts';

/**
 * Type-level: `useCofheReadContracts` types `data[i].result` per entry — a literal tuple index by
 * index, a homogeneous `.map` list as an array of one item type, an encrypted output as the
 * encrypted value rather than a bigint — and checks each entry against its own ABI, while a loose
 * entry shape still compiles with `unknown` results. `tsc` over the test tree (`check:types`) is
 * the assertion; the runtime `it` only keeps vitest from reporting an empty file.
 */

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

const CONFIDENTIAL_ABI = [
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'euint64' }],
  },
] as const;

const TOKEN = '0x00000000000000000000000000000000000000A1';
const HOLDER = '0x00000000000000000000000000000000000000B2';
const TOKENS: readonly `0x${string}`[] = [TOKEN, TOKEN];

// Named without the `use` prefix on purpose: the calls below never run, they are typed only.
type ReadContracts = typeof useCofheReadContracts;

function typeOnly(readContracts: ReadContracts, account: `0x${string}` | undefined) {
  // A literal tuple: every index carries its own entry's result type.
  const tuple = readContracts({
    contracts: [
      { address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [HOLDER] },
      { address: TOKEN, abi: ERC20_ABI, functionName: 'decimals' },
      { address: TOKEN, abi: CONFIDENTIAL_ABI, functionName: 'confidentialBalanceOf', args: [HOLDER] },
    ],
  });
  expectTypeOf(tuple.data?.[0]?.result).toEqualTypeOf<bigint | undefined>();
  expectTypeOf(tuple.data?.[1]?.result).toEqualTypeOf<number | undefined>();
  // An `euint64` output is the encrypted value, never a bigint — the cast that hid the stablecoin
  // regression is a compile error now.
  type EncryptedResult = NonNullable<NonNullable<NonNullable<typeof tuple.data>[2]>['result']>;
  expectTypeOf<EncryptedResult>().toHaveProperty('utype');
  expectTypeOf<EncryptedResult>().not.toBeBigInt();

  // Args not known yet: `undefined` with the batch gated by `enabled`, as on the singular hook —
  // the entry stays typed.
  const gated = readContracts(
    {
      contracts: [{ address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: account ? [account] : undefined }],
    },
    { enabled: !!account }
  );
  expectTypeOf(gated.data?.[0]?.result).toEqualTypeOf<bigint | undefined>();

  // A homogeneous list built in a `.map`: one item type for every element, as long as the
  // `functionName` stays literal.
  const list = readContracts({
    contracts: TOKENS.map((address) => ({
      address,
      abi: ERC20_ABI,
      functionName: 'balanceOf' as const,
      args: [HOLDER] as const,
    })),
  });
  expectTypeOf(list.data?.[0]?.result).toEqualTypeOf<bigint | undefined>();

  // A literal ABI with a widened `functionName` (a `.map` without `as const`) is `unknown` too — never
  // a guess across the ABI's functions.
  const widened = readContracts({
    contracts: TOKENS.map((address) => ({ address, abi: ERC20_ABI, functionName: 'balanceOf', args: [HOLDER] })),
  });
  expectTypeOf(widened.data?.[0]?.result).toEqualTypeOf<unknown>();

  // A loose entry shape (plain `Abi`, `string` functionName) still compiles — results are `unknown`.
  const looseEntries: readonly { address: `0x${string}`; abi: Abi; functionName: string }[] = [];
  const loose = readContracts({ contracts: looseEntries });
  expectTypeOf(loose.data?.[0]?.result).toEqualTypeOf<unknown>();

  // ...and a literal entry is checked against its own ABI.
  readContracts({
    // @ts-expect-error — not a view function of this ABI
    contracts: [{ address: TOKEN, abi: ERC20_ABI, functionName: 'transfer', args: [HOLDER, 1n] }],
  });
  readContracts({
    // @ts-expect-error — balanceOf takes an address, not a bigint
    contracts: [{ address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [1n] }],
  });
}

describe('useCofheReadContracts result typing', () => {
  it('types data[i].result per entry (type-level; see typeOnly above)', () => {
    expect(typeof typeOnly).toBe('function');
  });
});
