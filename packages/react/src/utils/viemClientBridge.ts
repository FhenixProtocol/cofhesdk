/**
 * Type bridges for multi-instance viem peer dependency scenarios.
 *
 * TypeScript tracks module identity by absolute file path. When viem is
 * resolved to more than one path in node_modules --- which can happen in any of
 * these situations:
 *
 *   - link: / workspace: references across separate repositories
 *   - pnpm resolving different instances due to differing peer-dep hashes
 *   - yarn/npm workspaces with hoisting producing duplicate installs
 *   - any monorepo setup where two packages independently declare viem
 *
 * ...then PublicClient and WalletClient from the two instances are treated
 * as distinct, incompatible types even if the viem version is identical.
 *
 * These utilities accept minimal local interfaces (only the fields that
 * distinguish a public client from a wallet client), perform a lightweight
 * runtime check that the key methods are present, and cast into the types
 * expected by @cofhe/react. The local interfaces are viem-independent, so
 * clients from any viem instance satisfy them without a type conflict.
 *
 * Once @cofhe/react is installed from a registry and pnpm deduplicates viem
 * to a single instance, these bridges become unnecessary --- but remain safe to
 * keep in place.
 */

import type { PublicClient, WalletClient } from 'viem';

/** Minimal local interface satisfied by any viem-like public client. */
export interface PublicClientLike {
  request: any;
  readContract: any;
}

/** Minimal local interface satisfied by any viem-like wallet client. */
export interface WalletClientLike {
  request: any;
  sendTransaction: any;
}

/**
 * Assert and cast a viem-like PublicClient into the one expected by @cofhe/react.
 *
 * Accepts any object satisfying {@link PublicClientLike} --- structurally
 * compatible with a viem PublicClient from any viem instance.
 */
export function asCofhePublicClient(client: PublicClientLike | undefined): PublicClient | undefined {
  if (client === undefined) return undefined;
  if (typeof client.request !== 'function' || typeof client.readContract !== 'function') {
    throw new Error('asCofhePublicClient: value is missing expected methods --- expected a viem PublicClient');
  }
  return client as unknown as PublicClient;
}

/**
 * Assert and cast a viem-like WalletClient into the one expected by @cofhe/react.
 *
 * Accepts undefined (no wallet connected), or any object satisfying
 * {@link WalletClientLike} --- structurally compatible with a viem WalletClient
 * from any viem instance.
 */
export function asCofheWalletClient(client: WalletClientLike | undefined): WalletClient | undefined {
  if (client === undefined) return undefined;
  if (typeof client.request !== 'function' || typeof client.sendTransaction !== 'function') {
    throw new Error('asCofheWalletClient: value is missing expected methods --- expected a viem WalletClient');
  }
  return client as unknown as WalletClient;
}
