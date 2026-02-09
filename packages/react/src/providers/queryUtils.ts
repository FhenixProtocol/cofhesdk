import { type QueryKey } from '@tanstack/react-query';

export function isPersistedQuery(options: { meta?: unknown; queryKey?: QueryKey }): boolean {
  const meta = options.meta as { persist?: boolean } | undefined;
  if (meta?.persist === true) return true;
  // Backwards compat: decrypt queries are implicitly persisted in QueryProvider.
  return options.queryKey?.[0] === 'decryptCiphertext';
}
