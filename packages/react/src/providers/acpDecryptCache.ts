import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { CofheClient } from '@cofhe/sdk';

type ACPSnapshot = ReturnType<CofheClient['acp']['getSnapshot']>;

/** Hashes of every stored ACP, across chains and accounts. */
export function storedACPHashes(snapshot: ACPSnapshot): Set<string> {
  const hashes = new Set<string>();
  for (const byAccount of Object.values(snapshot.acps ?? {}))
    for (const byHash of Object.values(byAccount ?? {}))
      for (const [hash, acp] of Object.entries(byHash ?? {})) if (acp) hashes.add(hash);
  return hashes;
}

/**
 * The ACP-hash segment of a decrypt key, the ACP the value was decrypted with: the last segment
 * of a view decrypt (`constructCofheDecryptQueryKey`) and of a tx decrypt
 * (`constructCofheDecryptForTxQueryKey`); `undefined` for any other query.
 */
function decryptQueryACPHash(queryKey: readonly unknown[]): unknown {
  if (queryKey[0] === 'decryptCiphertext') return queryKey[4];
  if (queryKey[0] === 'decryptForTx') return queryKey[3];
  return undefined;
}

/**
 * Drop every decrypt — a plaintext or a proof — cached under one of `acpHashes`.
 */
export function removeDecryptsOfACPs(queryClient: QueryClient, acpHashes: ReadonlySet<string>): void {
  if (acpHashes.size === 0) return;
  queryClient.removeQueries({
    predicate: (query) => {
      const acpHash = decryptQueryACPHash(query.queryKey);
      return typeof acpHash === 'string' && acpHashes.has(acpHash);
    },
  });
}

/**
 * Watch the ACP store and drop the decrypts of every ACP that leaves it, so plaintext decrypted
 * with a removed (e.g. shared) ACP does not outlive it in the cache.
 */
export function useDropDecryptsOfRemovedACPs(client: CofheClient, queryClient: QueryClient): void {
  useEffect(() => {
    let stored = storedACPHashes(client.acp.getSnapshot());
    return client.acp.subscribe(() => {
      const now = storedACPHashes(client.acp.getSnapshot());
      removeDecryptsOfACPs(queryClient, new Set([...stored].filter((hash) => !now.has(hash))));
      stored = now;
    });
  }, [client, queryClient]);
}
