import type { CofheClient } from '@cofhe/sdk';

/**
 * Module-level accessor for the CofheClient instance.
 *
 * This allows non-React code (stores, services, async functions) to access
 * the same client that CofheProvider manages in React context.
 *
 * The client is automatically set when CofheProvider connects and cleared
 * on disconnect — no manual setup needed.
 *
 * @example
 * ```ts
 * import { getCofheClient } from '@cofhe/react';
 *
 * async function decryptBalance(ctHash: bigint) {
 *   const client = getCofheClient();
 *   if (!client) throw new Error('Not connected');
 *   return client.decryptForView(ctHash, FheTypes.Uint128).withPermit().execute();
 * }
 * ```
 */
let _client: CofheClient | null = null;

/**
 * Returns the current CofheClient instance, or null if not connected.
 * Safe to call from non-React code (stores, services, event handlers).
 */
export function getCofheClient(): CofheClient | null {
  return _client;
}

/**
 * Returns true if a CofheClient is currently connected.
 */
export function isCofheConnected(): boolean {
  return _client !== null;
}

/**
 * @internal — Called by CofheProvider to sync the client instance.
 * Do not call directly.
 */
export function _setCofheClient(client: CofheClient | null): void {
  _client = client;
}
