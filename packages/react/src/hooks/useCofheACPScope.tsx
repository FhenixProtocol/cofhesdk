import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Address } from 'viem';
import { ACPUtils, type ACP } from '@cofhe/sdk/acps';
import { useCofheACP, useCofheActiveACP } from './useCofheACPs';

/** An ACP, or the hash of an ACP stored for the connected account. */
export type CofheACPInput = ACP | string;

export type CofheACPScopeValue = {
  /** The scope's ACP; `undefined` when it was given as a hash that is not in the store. */
  acp: ACP | undefined;
  /** The account whose data the ACP decrypts: its issuer. */
  issuer: Address | undefined;
  /** The ACP is present, signed and not expired. Revocation is not checked here. */
  isValid: boolean;
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

function describeACP(acp: ACP | undefined): CofheACPScopeValue {
  return { acp, issuer: acp?.issuer as Address | undefined, isValid: !!acp && ACPUtils.isValid(acp).valid };
}

/**
 * Decrypt with `acp` everywhere below: `useCofheReadContractAndDecrypt`, `useCofheReadContract(s)`
 * (ACP gating) and `useCofheTokenDecryptedBalance` use this ACP instead of the active one, and
 * `useCofheTokenDecryptedBalance` reads the issuer's balance unless given an account. The active ACP
 * is not changed, so the rest of the tree keeps decrypting the connected user's own data.
 *
 * Typical use: a read-only view of data someone shared with the user, next to the user's own
 * balances. Import the share with `client.acp.importShared(json, { activate: false })`, then wrap the
 * view in `<CofheACPScope acp={imported}>`.
 *
 * Nested scopes: the innermost wins. A hook's own `acp` option wins over any scope. A hash that is
 * not in the store, or an invalid (e.g. expired) ACP, disables the reads and decrypts in the scope
 * (`disabledDueToMissingValidACP`) instead of falling back to the active ACP.
 */
export function CofheACPScope({ acp, children }: { acp: CofheACPInput | undefined; children?: ReactNode }) {
  const resolved = useResolvedACP(acp);
  const expiryTick = useRerenderAtExpiry(resolved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => describeACP(resolved), [resolved, expiryTick]);
  return <CofheACPScopeContext.Provider value={value}>{children}</CofheACPScopeContext.Provider>;
}

/** The enclosing `<CofheACPScope>`, or `null` outside any scope. */
export function useCofheACPScope(): CofheACPScopeValue | null {
  return useContext(CofheACPScopeContext);
}

export type CofheEffectiveACP = CofheACPScopeValue & {
  /**
   * The ACP was chosen explicitly (a hook's `acp` option or an enclosing scope), so decrypts pass it
   * with `.withACP(acp)` and cache under its hash. `false` means the active ACP.
   */
  scoped: boolean;
};

/**
 * The ACP a read or decrypt uses: the hook's `acp` option, else the enclosing `<CofheACPScope>`,
 * else the active ACP on `chainId` (the connected chain by default).
 */
export function useCofheEffectiveACP({ acp, chainId }: { acp?: CofheACPInput; chainId?: number }): CofheEffectiveACP {
  const scope = useCofheACPScope();
  const resolved = useResolvedACP(acp, chainId);
  const expiryTick = useRerenderAtExpiry(resolved);
  const active = useCofheActiveACP(chainId);
  return useMemo(() => {
    if (acp !== undefined) return { ...describeACP(resolved), scoped: true };
    if (scope) return { ...scope, scoped: true };
    return {
      acp: active?.acp,
      issuer: active?.acp.issuer as Address | undefined,
      isValid: !!active?.isValid,
      scoped: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acp, resolved, expiryTick, scope, active]);
}
