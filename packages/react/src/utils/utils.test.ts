import { describe, expect, it } from 'vitest';

import { Encryptable } from '@cofhe/sdk';

import { FheTypesList, createEncryptableFromInput } from './utils';

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

describe('createEncryptableFromInput', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['false', false],
    ['False', false],
    ['0', false],
  ])('turns the bool input %s into %s', (value, expected) => {
    expect(createEncryptableFromInput('bool', value)).toEqual(Encryptable.bool(expected));
  });

  it('rejects text that is not a bool', () => {
    expect(() => createEncryptableFromInput('bool', 'yes')).toThrow('Invalid bool value');
  });

  it('passes numbers and addresses through as text', () => {
    expect(createEncryptableFromInput('uint32', '42')).toEqual(Encryptable.uint32('42'));
    const address = '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';
    expect(createEncryptableFromInput('address', address)).toEqual(Encryptable.address(address));
  });
});
