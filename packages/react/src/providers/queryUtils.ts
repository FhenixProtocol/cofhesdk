import { type QueryKey } from '@tanstack/react-query';

export function isPersistedQuery(options: { meta?: unknown; queryKey?: QueryKey }): boolean {
  const meta = options.meta as { persist?: boolean } | undefined;
  return meta?.persist === true;
}
