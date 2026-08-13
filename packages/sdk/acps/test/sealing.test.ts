import { describe, it, expect } from 'vitest';
import { GenerateSealingKey, seal, unsealWithPrivateKey } from '../index.js';

describe('seal / unsealWithPrivateKey', () => {
  it('should seal data into EthEncryptedData shape', () => {
    const publicKey = `0x${'b'.repeat(64)}`;
    const value = BigInt(12345);

    const encryptedData = seal(value, publicKey);

    expect(encryptedData).toHaveProperty('data');
    expect(encryptedData).toHaveProperty('public_key');
    expect(encryptedData).toHaveProperty('nonce');
    expect(encryptedData.data).toBeInstanceOf(Uint8Array);
    expect(encryptedData.public_key).toBeInstanceOf(Uint8Array);
    expect(encryptedData.nonce).toBeInstanceOf(Uint8Array);
  });

  it('should round-trip: seal for a generated key, unseal with its private key', () => {
    const pair = GenerateSealingKey();
    const value = BigInt(987654321);

    const sealed = seal(value, pair.publicKey);
    const unsealed = unsealWithPrivateKey(pair.privateKey, sealed);

    expect(unsealed).toBe(value);
  });

  it('accepts keys with or without the 0x prefix', () => {
    const pair = GenerateSealingKey();
    const value = BigInt(42);

    const sealed = seal(value, pair.publicKey.slice(2));
    expect(unsealWithPrivateKey(pair.privateKey.slice(2), sealed)).toBe(value);
  });

  it('should throw error for invalid public key in seal', () => {
    expect(() => {
      seal(BigInt(12345), 'invalid');
    }).toThrow('Public key must be of length 64');
  });

  it('should throw error for invalid private key in unseal', () => {
    const pair = GenerateSealingKey();
    const sealed = seal(BigInt(1), pair.publicKey);

    expect(() => {
      unsealWithPrivateKey('deadbeef', sealed);
    }).toThrow('Private key must be of length 64');
  });

  it('should throw error for invalid value in seal', () => {
    const publicKey = `0x${'b'.repeat(64)}`;

    expect(() => {
      // @ts-expect-error - invalid value
      seal('not a number', publicKey);
    }).toThrow('Value not a number is not a number or bigint: string');
  });
});

describe('GenerateSealingKey', () => {
  it('should generate a 0x-prefixed 32-byte hex pair', () => {
    const pair = GenerateSealingKey();

    expect(pair.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(pair.publicKey).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should generate different keys on each call', () => {
    const key1 = GenerateSealingKey();
    const key2 = GenerateSealingKey();

    expect(key1.privateKey).not.toBe(key2.privateKey);
    expect(key1.publicKey).not.toBe(key2.publicKey);
  });
});
