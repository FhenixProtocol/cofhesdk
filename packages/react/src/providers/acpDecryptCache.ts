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
 * Drop every decrypt cached under one of `acpHashes`: the ACP-hash segment of the decrypt key
 * (see `constructCofheDecryptQueryKey`), the ACP each value was decrypted with.
 */
export function removeDecryptsOfACPs(queryClient: QueryClient, acpHashes: ReadonlySet<string>): void {
  if (acpHashes.size === 0) return;
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey[0] === 'decryptCiphertext' &&
      typeof query.queryKey[4] === 'string' &&
      acpHashes.has(query.queryKey[4]),
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
