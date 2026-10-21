import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { removeDecryptsOfACPs, storedACPHashes } from './acpDecryptCache';

const decryptKey = (ctHash: string, acpHash: string | undefined) => ['decryptCiphertext', 1, ctHash, 2, acpHash];
const proofKey = (ctHash: string, acpHash: string | null) => ['decryptForTx', 1, ctHash, acpHash];

describe('storedACPHashes', () => {
  it('collects the hashes of every stored ACP across chains and accounts, skipping empty slots', () => {
    const snapshot = {
      acps: { 1: { '0xa': { h1: {} as any, h2: undefined } }, 2: { '0xb': { h3: {} as any } } },
      activeACPHash: {},
    } as any;
    expect([...storedACPHashes(snapshot)].sort()).toStrictEqual(['h1', 'h3']);
  });
});

describe('removeDecryptsOfACPs', () => {
  it('drops only the decrypts keyed under the given ACP hashes', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(decryptKey('0x1', 'shared'), 1n);
    queryClient.setQueryData(decryptKey('0x2', 'shared'), 2n);
    queryClient.setQueryData(decryptKey('0x1', undefined), 1n);
    queryClient.setQueryData(decryptKey('0x3', 'other'), 3n);
    queryClient.setQueryData(['cofheReadContract', 1, '0x1', 'shared'], 'read');

    removeDecryptsOfACPs(queryClient, new Set(['shared']));

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(decryptKey('0x1', undefined));
    expect(keys).toContainEqual(decryptKey('0x3', 'other'));
    expect(keys).toContainEqual(['cofheReadContract', 1, '0x1', 'shared']);
  });

  it('drops the proofs keyed under the given ACP hashes, not those decrypted without an ACP', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(proofKey('0x1', 'shared'), { decryptedValue: 1n });
    queryClient.setQueryData(proofKey('0x2', null), { decryptedValue: 2n });
    queryClient.setQueryData(proofKey('0x3', 'other'), { decryptedValue: 3n });

    removeDecryptsOfACPs(queryClient, new Set(['shared']));

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(keys).toStrictEqual([proofKey('0x2', null), proofKey('0x3', 'other')]);
  });

  it('does nothing for an empty set', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(decryptKey('0x1', 'shared'), 1n);
    removeDecryptsOfACPs(queryClient, new Set());
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });
});
