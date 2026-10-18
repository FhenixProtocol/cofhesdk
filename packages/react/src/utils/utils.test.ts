import { describe, expect, it } from 'vitest';

import { FheTypesList } from './utils';

describe('FheTypesList', () => {
  it.each([
    ['uint8', 8n],
    ['uint16', 16n],
    ['uint32', 32n],
    ['uint64', 64n],
    ['uint128', 128n],
  ])('%s maxValue is 2^bits - 1', (value, bits) => {
    expect(FheTypesList.find((type) => type.value === value)?.maxValue).toBe(2n ** bits - 1n);
  });
});
