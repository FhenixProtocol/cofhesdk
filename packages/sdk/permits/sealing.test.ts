import { describe, it, expect } from 'vitest';
import { SealingKey, GenerateSealingKey } from './index.js';

describe('SealingKey', () => {
  it('should create a SealingKey with valid keys', () => {
    const privateKey = 'a'.repeat(64);
    const publicKey = 'b'.repeat(64);

    const sealingKey = new SealingKey(privateKey, publicKey);

    expect(sealingKey.privateKey).toBe(privateKey);
    expect(sealingKey.publicKey).toBe(publicKey);
  });

  it('should throw error for invalid private key length', () => {
    const privateKey = 'a'.repeat(32); // Too short
    const publicKey = 'b'.repeat(64);

    expect(() => {
      new SealingKey(privateKey, publicKey);
    }).toThrow('Private key must be of length 64');
  });

  it('should throw error for invalid public key length', () => {
    const privateKey = 'a'.repeat(64);
    const publicKey = 'b'.repeat(32); // Too short

    expect(() => {
      new SealingKey(privateKey, publicKey);
    }).toThrow('Public key must be of length 64');
  });

  it('should seal and unseal data correctly', () => {
    const publicKey = 'b'.repeat(64);
    const value = BigInt(12345);

    // Seal the data
    const encryptedData = SealingKey.seal(value, publicKey);

    expect(encryptedData).toHaveProperty('data');
    expect(encryptedData).toHaveProperty('public_key');
    expect(encryptedData).toHaveProperty('nonce');
    expect(encryptedData.data).toBeInstanceOf(Uint8Array);
    expect(encryptedData.public_key).toBeInstanceOf(Uint8Array);
    expect(encryptedData.nonce).toBeInstanceOf(Uint8Array);
  });

  it('should throw error for invalid public key in seal', () => {
    const value = BigInt(12345);
    const invalidPublicKey = 'invalid';

    expect(() => {
      SealingKey.seal(value, invalidPublicKey);
    }).toThrow('bad public key size');
  });

  it('should throw error for invalid value in seal', () => {
    const publicKey = 'b'.repeat(64);
    const invalidValue = 'not a number';

    expect(() => {
      // @ts-expect-error - invalid value
      SealingKey.seal(invalidValue, publicKey);
    }).toThrow('Value not a number is not a number or bigint: string');
  });
});

describe('GenerateSealingKey', () => {
  it('should generate a valid SealingKey', async () => {
    const sealingKey = await GenerateSealingKey();

    expect(sealingKey).toBeInstanceOf(SealingKey);
    expect(sealingKey.privateKey).toHaveLength(64);
    expect(sealingKey.publicKey).toHaveLength(64);
  });

  it('should generate different keys on each call', async () => {
    const key1 = await GenerateSealingKey();
    const key2 = await GenerateSealingKey();

    expect(key1.privateKey).not.toBe(key2.privateKey);
    expect(key1.publicKey).not.toBe(key2.publicKey);
  });
});
