import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Address } from 'viem';
import { ACPScope, ACPUtils, type ACP, type ACPAccessStatus } from '@cofhe/sdk/acps';
import { useCofheContext, useInternalQuery } from '@/providers';
import { useCofheACP, useCofheActiveACP } from './useCofheACPs';
import { useCofheConnection } from './useCofheConnection';

/** An ACP, or the hash of an ACP stored for the connected account. */
export type CofheACPInput = ACP | string;

/**
 * Whether a chosen ACP can decrypt right now:
 * - `checking`: signed and unexpired; its on-chain check (revocation) is in flight
 * - `valid`: passes the on-chain check
 * - `expired` / `revoked`: as the ACL reports it (expiry is also caught locally, when it happens)
 * - `invalid`: not stored (unknown hash), unsigned, or its signatures fail on chain
 * - `unverified`: the on-chain check failed (e.g. a network error); it is retried
 */
export type CofheACPStatus = 'checking' | 'valid' | 'expired' | 'revoked' | 'invalid' | 'unverified';

export type CofheACPScopeValue = {
  /** The scope ACP; `undefined` when it was given as a hash that is not in the store. */
  acp: ACP | undefined;
  /** The account whose data the ACP decrypts: its issuer. */
  issuer: Address | undefined;
  /** `status === 'valid'`: the only state in which reads and decrypts in the scope run. */
  isValid: boolean;
  status: CofheACPStatus;
};

/** How often a chosen ACP is re-checked on chain for revocation, besides on window focus. */
const ACP_STATUS_RECHECK_MS = 60_000;
/** Query key prefix of an ACP on-chain status; `[prefix, acp.hash]`. Invalidate it to force a re-check. */
export const ACP_STATUS_QUERY_KEY = 'cofheACPStatus';

const ON_CHAIN_STATUS: Record<ACPAccessStatus, CofheACPStatus> = {
  valid: 'valid',
  allowed: 'valid',
  'out-of-scope': 'valid',
  'issuer-not-allowed': 'valid',
  expired: 'expired',
  revoked: 'revoked',
  'invalid-issuer-signature': 'invalid',
  'invalid-recipient-signature': 'invalid',
};

const CofheACPScopeContext = createContext<CofheACPScopeValue | null>(null);

function useResolvedACP(input: CofheACPInput | undefined, chainId?: number): ACP | undefined {
  const stored = useCofheACP(typeof input === 'string' ? input : '', chainId);
  return typeof input === 'string' ? stored : input;
}

/**
 * Re-render once `acp` has expired, so a validity computed at render catches the expiry while
 * the view stays mounted. Returns a counter to add to the memo dependencies.
 */
function useRerenderAtExpiry(acp: ACP | undefined): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const expiration = acp?.expiration;
  useEffect(() => {
    if (expiration === undefined) return;
    const ms = expiration * 1000 - Date.now() + 1000;
    if (ms <= 0) return;
    const id = setTimeout(bump, Math.min(ms, 2_147_483_647));
    return () => clearTimeout(id);
  }, [expiration]);
  return tick;
}

/**
 * A chosen ACP status: local checks first (present, signed, unexpired), then the ACL on chain,
 * re-checked every minute and on window focus so a revocation shows up while the view is open.
 * On a chain other than the connected one the on-chain check is skipped (the client reads the
 * connected chain), so revocation is not detected there.
 */
function useChosenACPStatus(acp: ACP | undefined, chainId?: number): CofheACPStatus {
  const { client } = useCofheContext();
  const connection = useCofheConnection();
  const expiryTick = useRerenderAtExpiry(acp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const locallyValid = useMemo(() => !!acp && ACPUtils.isValid(acp).valid, [acp, expiryTick]);
  const onConnectedChain = chainId === undefined || chainId === connection.chainId;

  const onChain = useInternalQuery({
    queryKey: [ACP_STATUS_QUERY_KEY, acp?.hash],
    queryFn: () => client.acp.checkAccess(acp as ACP),
    enabled: locallyValid && connection.connected && onConnectedChain,
    refetchInterval: ACP_STATUS_RECHECK_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (!acp) return 'invalid';
  if (!locallyValid) return ACPUtils.isExpired(acp) ? 'expired' : 'invalid';
  if (!onConnectedChain) return 'valid';
  // The latest check decides: after a failed re-check an earlier 'valid' is not trusted, since
  // revocation is exactly what a re-check exists to catch.
  if (onChain.errorUpdatedAt > onChain.dataUpdatedAt) return 'unverified';
  if (onChain.data) return ON_CHAIN_STATUS[onChain.data];
  return 'checking';
}

function describeACP(acp: ACP | undefined, status: CofheACPStatus): CofheACPScopeValue {
  return { acp, issuer: acp?.issuer as Address | undefined, isValid: status === 'valid', status };
}

/**
 * A SNAPSHOT (handle-scope) ACP that does not list `ctHash`: decrypting it can only fail, so it is
 * never sent. A zero handle (a known zero) is never out of scope.
 */
export function isHandleOutOfScope(acp: ACP | undefined, ctHash: bigint | string | undefined): boolean {
  if (!acp || acp.scope !== ACPScope.Handles || ctHash === undefined) return false;
  const target = BigInt(ctHash);
  if (target === 0n) return false;
  return !acp.handles.some((handle) => BigInt(handle) === target);
}

/**
 * Decrypt with `acp` everywhere below: `useCofheReadContractAndDecrypt`, `useCofheReadContract(s)`
 * (ACP gating) and `useCofheTokenDecryptedBalance` use this ACP instead of the active one, and
 * `useCofheTokenDecryptedBalance` reads the issuer balance unless given an account. The active ACP
 * is not changed, so the rest of the tree keeps decrypting the connected user own data.
 *
 * Typical use: a read-only view of data someone shared with the user, next to the user own
 * balances. Import the share with `client.acp.importShared(json, { activate: false })`, then wrap the
 * view in `<CofheACPScope acp={imported}>`.
 *
 * The ACP is checked on chain when the scope mounts, every minute and on window focus
 * (`useCofheACPScope().status`). Until it is `valid`, and after it is revoked, expired, removed or
 * unknown, the reads and decrypts in the scope are disabled (`disabledDueToMissingValidACP`)
 * instead of falling back to the active ACP. Nested scopes: the innermost wins. A hook own `acp`
 * option wins over any scope.
 */
export function CofheACPScope({ acp, children }: { acp: CofheACPInput | undefined; children?: ReactNode }) {
  const resolved = useResolvedACP(acp);
  const status = useChosenACPStatus(resolved);
  const value = useMemo(() => describeACP(resolved, status), [resolved, status]);
  return <CofheACPScopeContext.Provider value={value}>{children}</CofheACPScopeContext.Provider>;
}

/** The enclosing `<CofheACPScope>`, or `null` outside any scope. */
export function useCofheACPScope(): CofheACPScopeValue | null {
  return useContext(CofheACPScopeContext);
}

/**
 * The on-chain status of one ACP (or of a stored ACP given by hash), checked when mounted, every
 * minute and on window focus; see `CofheACPStatus`. `status === 'revoked'` after
 * `useCofheRevokeACP` mines. Independent of any scope.
 */
export function useCofheACPStatus(acp: CofheACPInput | undefined, chainId?: number): CofheACPScopeValue {
  const resolved = useResolvedACP(acp, chainId);
  const status = useChosenACPStatus(resolved, chainId);
  return useMemo(() => describeACP(resolved, status), [resolved, status]);
}

export type CofheEffectiveACP = CofheACPScopeValue & {
  /**
   * The ACP was chosen explicitly (a hook `acp` option or an enclosing scope), so decrypts pass it
   * with `.withACP(acp)` and cache under its hash. `false` means the active ACP.
   */
  scoped: boolean;
};

/**
 * The ACP a read or decrypt uses: the hook `acp` option, else the enclosing `<CofheACPScope>`,
 * else the active ACP on `chainId` (the connected chain by default).
 */
export function useCofheEffectiveACP({ acp, chainId }: { acp?: CofheACPInput; chainId?: number }): CofheEffectiveACP {
  const scope = useCofheACPScope();
  const resolved = useResolvedACP(acp, chainId);
  const optionStatus = useChosenACPStatus(acp !== undefined ? resolved : undefined, chainId);
  const active = useCofheActiveACP(chainId);
  return useMemo(() => {
    if (acp !== undefined) return { ...describeACP(resolved, optionStatus), scoped: true };
    if (scope) return { ...scope, scoped: true };
    const activeACP = active?.acp;
    const status: CofheACPStatus = active?.isValid
      ? 'valid'
      : activeACP && ACPUtils.isExpired(activeACP)
        ? 'expired'
        : 'invalid';
    return { ...describeACP(activeACP, status), scoped: false };
  }, [acp, resolved, optionStatus, scope, active]);
}
