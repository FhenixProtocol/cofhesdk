/**
 * Type bridges for multi-instance viem peer dependency scenarios.
 *
 * TypeScript tracks module identity by absolute file path. When viem is
 * resolved to more than one path in node_modules — which can happen in any of
 * these situations:
 *
 *   - `link:` / `workspace:` references across separate repositories
 *   - pnpm resolving different instances due to differing peer-dep hashes
 *   - yarn/npm workspaces with hoisting producing duplicate installs
 *   - any monorepo setup where two packages independently declare viem
 *
 * ...then `PublicClient` and `WalletClient` from the two instances are treated
 * as distinct, incompatible types even if the viem version is identical.
 *
 * These utilities let consumers pass their locally-typed clients into
 * CofheProvider without unsafe `as never` casts. They perform structural
 * shape checks at runtime so obvious mistakes (wrong type, null, missing
 * methods) throw immediately rather than failing silently deep in the SDK.
 *
 * Once @cofhe/react is installed from a registry and pnpm deduplicates viem
 * to a single instance, these bridges become unnecessary — but remain safe to
 * keep in place.
 */

import type { PublicClient, WalletClient } from 'viem';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Assert and cast an unknown value into the PublicClient expected by @cofhe/react.
 *
 * Checks that the value has the minimal shape of a viem PublicClient:
 * a `request` function (present on all viem clients) and a `readContract`
 * function (distinguishes a public client from a wallet client).
 */
export function asCofhePublicClient(client: unknown): PublicClient {
    if (!isObject(client)) {
        throw new Error(
            `asCofhePublicClient: expected a PublicClient object, got ${client === null ? 'null' : typeof client}`,
        );
    }
    if (typeof client['request'] !== 'function') {
        throw new Error('asCofhePublicClient: value is missing a `request` method — is it a viem client?');
    }
    if (typeof client['readContract'] !== 'function') {
        throw new Error(
            'asCofhePublicClient: value is missing `readContract` — expected a PublicClient, not a WalletClient or other object',
        );
    }
    return client as unknown as PublicClient;
}

/**
 * Assert and cast an unknown value into the WalletClient expected by @cofhe/react.
 *
 * Accepts `undefined` (no wallet connected). For non-undefined values checks
 * that the value has the minimal shape of a viem WalletClient: a `request`
 * function (present on all viem clients) and a `sendTransaction` function
 * (distinguishes a wallet client from a public client).
 */
export function asCofheWalletClient(client: unknown): WalletClient | undefined {
    if (client === undefined) return undefined;
    if (!isObject(client)) {
        throw new Error(
            `asCofheWalletClient: expected a WalletClient object or undefined, got ${client === null ? 'null' : typeof client}`,
        );
    }
    if (typeof client['request'] !== 'function') {
        throw new Error('asCofheWalletClient: value is missing a `request` method — is it a viem client?');
    }
    if (typeof client['sendTransaction'] !== 'function') {
        throw new Error(
            'asCofheWalletClient: value is missing `sendTransaction` — expected a WalletClient, not a PublicClient or other object',
        );
    }
    return client as unknown as WalletClient;
}
