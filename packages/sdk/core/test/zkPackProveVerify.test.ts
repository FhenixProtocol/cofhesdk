import { describe, expect, it } from 'vitest';
import { constructZkPoKMetadata } from '../encrypt/zkPackProveVerify.js';

const metadataChainId = (metadata: Uint8Array): bigint => {
  return metadata.slice(21, 53).reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
};

describe('constructZkPoKMetadata', () => {
  it('encodes chain IDs larger than 32 bits without truncation', () => {
    const chainId = 2 ** 40 + 123;
    const metadata = constructZkPoKMetadata('0x1234567890123456789012345678901234567890', 7, chainId);

    expect(metadata).toHaveLength(53);
    expect(metadata[0]).toBe(7);
    expect(metadataChainId(metadata)).toBe(BigInt(chainId));
  });
});
