import { describe, it, expect } from 'vitest';
import { constructZkPoKMetadata } from '../encrypt/zkPackProveVerify.js';
import { toHexString } from '../utils.js';

describe('constructZkPoKMetadata', () => {
  const account = '0x1234567890123456789012345678901234567890';
  const contract = '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';

  it('lays out security zone, account, chain id and the consuming contract', () => {
    const metadata = constructZkPoKMetadata(account, 3, 0x010203, contract);

    expect(metadata.length).toBe(1 + 20 + 32 + 20);
    expect(metadata[0]).toBe(3);
    expect('0x' + toHexString(metadata.slice(1, 21))).toBe(account);
    const chainId = metadata.slice(21, 53);
    expect(Array.from(chainId.slice(0, 29))).toEqual(new Array(29).fill(0));
    expect(Array.from(chainId.slice(29))).toEqual([1, 2, 3]);
    expect('0x' + toHexString(metadata.slice(53))).toBe(contract);
  });

  it('accepts the consuming contract with or without the 0x prefix', () => {
    const withPrefix = constructZkPoKMetadata(account, 0, 1, contract);
    const withoutPrefix = constructZkPoKMetadata(account, 0, 1, contract.slice(2));

    expect(Array.from(withoutPrefix)).toEqual(Array.from(withPrefix));
  });
});
