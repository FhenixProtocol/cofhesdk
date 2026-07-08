import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useInternalQueryClient } from '@/providers';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useCofheActivePermit } from './useCofhePermits';
import type { CofheQueryMeta } from '@/meta';

// ============================================================================
// Decryption activity — the lifecycle view of confidential reads + decryptions.
// ============================================================================
//
// A confidential value is a two-stage pipeline, both stages living as react-query
// queries on the SDK's internal QueryClient:
//   A) FETCH  — read the ciphertext handle on-chain  (`cofheReadContract`),
//               whose data carries the `ctHash`.
//   B) DECRYPT— decrypt that handle off-chain         (`decryptCiphertext`, keyed
//               BY the ctHash).
//
// This hook observes the cache, correlates the two stages by ctHash, and returns
// one row per confidential value with a recognizable contract/method/label (from
// each query's `meta`) — surfacing states a plain error/loading flag can't:
//   • "blocked" — gated off by a missing/invalid permit (never runs, never errors)
//   • "stale"   — fetched, but the decrypt is pending far too long / never lands
// Consumers render the rows; no query-key parsing or side registries required.

const DEFAULT_STALE_MS = 25_000;
const nowSec = () => Math.floor(Date.now() / 1000);

/** 'idle' = a read/decrypt query exists but is disabled/never-ran (fetchStatus 'idle'), vs 'pending' (in flight). */
export type FetchStageState = 'ok' | 'pending' | 'idle' | 'error' | 'empty';
export type DecryptStageState = 'ok' | 'pending' | 'idle' | 'stale' | 'error' | 'blocked' | 'absent';
export type PermitState = 'valid' | 'expired' | 'unsigned' | 'none';
/** Coarse bucket for filtering: something wrong / decrypted / nothing conclusive. */
export type DecryptionActivityCategory = 'error' | 'success' | 'idle';

export interface DecryptionActivityRow {
  key: string;
  /** Canonical decimal ctHash, when known. */
  ctHash?: string;
  /** 0x…-shortened ctHash for display. */
  ctHashShort?: string;
  /** The originating query metadata (contract / method / label / consumer fields). */
  meta?: CofheQueryMeta;
  /** Convenience shortcuts pulled from meta. */
  chainId?: number;
  address?: string;
  functionName?: string;
  label?: string;
  fetch: FetchStageState;
  decrypt: DecryptStageState;
  category: DecryptionActivityCategory;
  /** Why the row is blocked, e.g. "permit none". */
  blockedReason?: string;
  /** How long the decrypt has been pending, ms (drives "stale"). */
  pendingMs?: number;
  updatedAt: number;
  /** Whether re-running is possible (false for gated/idle reads with nothing enabled). */
  canRetry: boolean;
  /** Re-run this value's read and/or decrypt. */
  retry: () => void;
}

export interface DecryptionActivityResult {
  rows: DecryptionActivityRow[];
  counts: { total: number; ok: number; pending: number; stale: number; blocked: number; error: number };
  permit: { state: PermitState; expiresInSec?: number };
  /** Wipe the whole SDK query cache; mounted reads/decryptions refetch from scratch. */
  clearCache: () => void;
}

export interface UseCofheDecryptionActivityOptions {
  /** How long a decrypt may stay pending before it's reported "stale" (default 25s). */
  staleMs?: number;
}

// Minimal structural view of a cached query — enough to classify without depending
// on react-query's concrete generic types.
interface QueryLike {
  queryKey: unknown;
  queryHash: string;
  meta?: CofheQueryMeta;
  state: { status: 'pending' | 'error' | 'success'; fetchStatus?: string; data?: unknown; dataUpdatedAt?: number };
}
interface CacheLike {
  getAll: () => QueryLike[];
  subscribe: (cb: () => void) => () => void;
}
interface ClientLike {
  getQueryCache: () => CacheLike;
  refetchQueries: (filters: { queryKey: unknown; exact?: boolean }) => Promise<unknown>;
  clear: () => void;
}

function normalizeCt(x: unknown): string | undefined {
  if (x === null || x === undefined) return undefined;
  try {
    return BigInt(x as string | number | bigint).toString();
  } catch {
    const s = String(x);
    return s && s !== '[object Object]' ? s : undefined;
  }
}

// A ctHash of 0 is not a real handle: reads return it for an absent/encrypted-zero
// value and the decrypt is gated on `ctHash > 0n`, so treat it as "no handle".
function isZeroCt(ct: string | undefined): boolean {
  if (!ct) return false;
  try {
    return BigInt(ct) === 0n;
  } catch {
    return false;
  }
}

function shortCt(decimal: string): string {
  try {
    const hex = BigInt(decimal).toString(16);
    return hex.length > 10 ? `0x${hex.slice(0, 6)}…${hex.slice(-4)}` : `0x${hex}`;
  } catch {
    return decimal;
  }
}

function extractCtHash(data: unknown): string | undefined {
  if (data === null || data === undefined) return undefined;
  if (typeof data === 'bigint') return normalizeCt(data);
  if (typeof data === 'object' && data !== null && 'ctHash' in (data as Record<string, unknown>)) {
    return normalizeCt((data as { ctHash: unknown }).ctHash);
  }
  return undefined;
}

// The read key bakes the transient activePermitHash + enabled flags into its tail,
// so the SAME value gets a fresh cache entry each time a permit appears/rotates.
// Its stable identity is [prefix, chainId, address, fn, args] (indices 0-4).
function stableReadKey(k: unknown[]): string {
  try {
    return JSON.stringify(k.slice(0, 5));
  } catch {
    return String(k[1]) + '|' + String(k[2]) + '|' + String(k[3]);
  }
}

// Progress of a read: ran (success/error) > in flight > idle/never-ran.
function readProgress(q: QueryLike): number {
  if (q.state.status === 'success' || q.state.status === 'error') return 2;
  if (q.state.fetchStatus === 'fetching') return 1;
  return 0;
}
function isFresherRead(candidate: QueryLike, current: QueryLike): boolean {
  const pc = readProgress(candidate);
  const pk = readProgress(current);
  if (pc !== pk) return pc > pk;
  return (candidate.state.dataUpdatedAt ?? 0) > (current.state.dataUpdatedAt ?? 0);
}

function categoryFor(fetch: FetchStageState, decrypt: DecryptStageState): DecryptionActivityCategory {
  if (fetch === 'error' || decrypt === 'error' || decrypt === 'blocked' || decrypt === 'stale') return 'error';
  if (decrypt === 'ok') return 'success';
  return 'idle';
}

/**
 * Observe the ctHash-fetch → decrypt pipeline on the SDK's QueryClient, correlated
 * by ctHash and cross-referenced against the active permit. Must be used inside the
 * Cofhe provider.
 */
export function useCofheDecryptionActivity(options?: UseCofheDecryptionActivityOptions): DecryptionActivityResult {
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const queryClient = useInternalQueryClient() as unknown as ClientLike;
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const active = useCofheActivePermit();
  const permitObj = active?.permit;

  // Track when each decrypt first went pending, so "stale" is real elapsed time
  // (react-query doesn't expose a fetch-start timestamp for a never-resolved query).
  const pendingSinceRef = useRef(new Map<string, number>());

  // Re-render on cache changes AND on a slow tick (staleness is time-based, not
  // event-driven — a query sitting pending emits no cache events).
  //
  // Coalesce cache events to one bump per animation frame. `cache.subscribe` fires
  // synchronously on EVERY cache event (including observer option/result updates),
  // and a consumer re-render can itself emit fresh cache events — an unbounded
  // bump→render→event→bump storm that pins the main thread and starves unrelated
  // updates (e.g. a route change never commits). One bump per frame keeps the view
  // live while capping re-renders so the loop can't run away.
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      const run = () => {
        scheduled = false;
        bump();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 16);
    };
    const unsub = cache.subscribe(schedule);
    const tick = setInterval(bump, 5_000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, [queryClient]);

  const clearCache = useCallback(() => queryClient.clear(), [queryClient]);

  const data = useMemo(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    const now = Date.now();

    const refetch = (key: unknown) => void queryClient.refetchQueries({ queryKey: key, exact: true });

    const permitState: PermitState = !permitObj
      ? 'none'
      : !permitObj.issuerSignature || permitObj.issuerSignature === '0x'
        ? 'unsigned'
        : permitObj.expiration <= nowSec()
          ? 'expired'
          : 'valid';
    const permitValid = permitState === 'valid';

    // Index decrypt queries by ctHash (source contract + label come from meta).
    const decryptByCt = new Map<
      string,
      { state: 'ok' | 'pending' | 'idle' | 'error'; pendingMs?: number; key?: unknown; meta?: CofheQueryMeta }
    >();
    const seenPending = new Set<string>();
    for (const q of queries) {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== 'decryptCiphertext') continue;
      const ct = normalizeCt(k[1]);
      if (!ct || isZeroCt(ct)) continue;
      const base = { key: q.queryKey, meta: q.meta };
      if (q.state.status === 'success') {
        decryptByCt.set(ct, { state: 'ok', ...base });
        pendingSinceRef.current.delete(ct);
      } else if (q.state.status === 'error') {
        decryptByCt.set(ct, { state: 'error', ...base });
        pendingSinceRef.current.delete(ct);
      } else if (q.state.fetchStatus === 'fetching') {
        seenPending.add(ct);
        let since = pendingSinceRef.current.get(ct);
        if (since === undefined) {
          since = now;
          pendingSinceRef.current.set(ct, since);
        }
        decryptByCt.set(ct, { state: 'pending', pendingMs: now - since, ...base });
      } else {
        // status 'pending' but fetchStatus 'idle' → disabled / never ran.
        pendingSinceRef.current.delete(ct);
        decryptByCt.set(ct, { state: 'idle', ...base });
      }
    }

    const rows: DecryptionActivityRow[] = [];
    const usedCt = new Set<string>();

    // Collapse per-permit/enabled key rotations to one entry per value.
    const readByValue = new Map<string, QueryLike>();
    for (const q of queries) {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== 'cofheReadContract') continue;
      const id = stableReadKey(k);
      const existing = readByValue.get(id);
      if (!existing || isFresherRead(q, existing)) readByValue.set(id, q);
    }

    const pushRow = (
      row: Omit<DecryptionActivityRow, 'category' | 'canRetry' | 'retry'> & {
        fetchKey?: unknown;
        decryptKey?: unknown;
      }
    ) => {
      const { fetchKey, decryptKey, ...rest } = row;
      const canRetry = rest.fetch !== 'idle' && (fetchKey !== undefined || decryptKey !== undefined);
      rows.push({
        ...rest,
        category: categoryFor(rest.fetch, rest.decrypt),
        canRetry,
        retry: () => {
          if (fetchKey !== undefined) refetch(fetchKey);
          if (decryptKey !== undefined) refetch(decryptKey);
        },
      });
    };

    // One row per confidential value; attach its decrypt stage by ctHash.
    for (const q of readByValue.values()) {
      const m = q.meta;
      const ctRaw = q.state.status === 'success' ? extractCtHash(q.state.data) : undefined;
      const ct = ctRaw && !isZeroCt(ctRaw) ? ctRaw : undefined;
      const fetchInFlight = q.state.fetchStatus === 'fetching';
      const fetchState: FetchStageState =
        q.state.status === 'error'
          ? 'error'
          : q.state.status === 'pending'
            ? fetchInFlight
              ? 'pending'
              : 'idle'
            : ct
              ? 'ok'
              : 'empty';

      let decrypt: DecryptStageState = 'absent';
      let blockedReason: string | undefined;
      let pendingMs: number | undefined;
      let decryptKey: unknown;
      let decryptMeta: CofheQueryMeta | undefined;
      if (ct) {
        usedCt.add(ct);
        const d = decryptByCt.get(ct);
        decryptKey = d?.key;
        decryptMeta = d?.meta;
        if (d?.state === 'ok') decrypt = 'ok';
        else if (d?.state === 'error') decrypt = 'error';
        else if (d?.state === 'idle') decrypt = 'idle';
        else if (d?.state === 'pending') {
          pendingMs = d.pendingMs;
          decrypt = (d.pendingMs ?? 0) > staleMs ? 'stale' : 'pending';
        } else {
          decrypt = permitValid ? 'absent' : 'blocked';
          if (!permitValid) blockedReason = `permit ${permitState}`;
        }
      } else if (fetchState === 'idle' && !permitValid) {
        // The read is gated off (no valid permit) — blocked before any ctHash.
        decrypt = 'blocked';
        blockedReason = `permit ${permitState}`;
      }

      const meta = m ?? decryptMeta;
      pushRow({
        key: q.queryHash,
        ctHash: ct,
        ctHashShort: ct ? shortCt(ct) : undefined,
        meta,
        chainId: meta?.chainId,
        address: meta?.address,
        functionName: meta?.functionName,
        label: meta?.consumer?.label,
        fetch: fetchState,
        decrypt,
        blockedReason,
        pendingMs,
        updatedAt: now,
        fetchKey: q.queryKey,
        decryptKey,
      });
    }

    // Orphan decrypts (a ctHash being decrypted with no fetch query in cache).
    for (const [ct, d] of decryptByCt) {
      if (usedCt.has(ct)) continue;
      const decrypt: DecryptStageState =
        d.state === 'ok'
          ? 'ok'
          : d.state === 'error'
            ? 'error'
            : d.state === 'idle'
              ? 'idle'
              : (d.pendingMs ?? 0) > staleMs
                ? 'stale'
                : 'pending';
      pushRow({
        key: `decrypt:${ct}`,
        ctHash: ct,
        ctHashShort: shortCt(ct),
        meta: d.meta,
        chainId: d.meta?.chainId,
        address: d.meta?.address,
        functionName: d.meta?.functionName,
        label: d.meta?.consumer?.label,
        fetch: 'ok',
        decrypt,
        pendingMs: d.pendingMs,
        updatedAt: now,
        decryptKey: d.key,
      });
    }

    // Drop ctHashes we no longer see, so the pending-since map can't grow unbounded.
    for (const ct of pendingSinceRef.current.keys()) {
      if (!seenPending.has(ct)) pendingSinceRef.current.delete(ct);
    }

    const counts = {
      total: rows.length,
      ok: rows.filter((r) => r.decrypt === 'ok').length,
      pending: rows.filter((r) => r.decrypt === 'pending').length,
      stale: rows.filter((r) => r.decrypt === 'stale').length,
      blocked: rows.filter((r) => r.decrypt === 'blocked').length,
      error: rows.filter((r) => r.decrypt === 'error' || r.fetch === 'error').length,
    };

    // Most actionable first: blocked/stale/error, then pending, then done.
    const rank: Record<DecryptStageState, number> = {
      blocked: 0,
      stale: 1,
      error: 2,
      pending: 3,
      idle: 4,
      absent: 5,
      ok: 6,
    };
    rows.sort((a, b) => rank[a.decrypt] - rank[b.decrypt]);

    const expiresInSec = permitObj ? permitObj.expiration - nowSec() : undefined;
    return { rows, permit: { state: permitState, expiresInSec }, counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, account, chainId, permitObj, staleMs, version]);

  return { ...data, clearCache };
}
