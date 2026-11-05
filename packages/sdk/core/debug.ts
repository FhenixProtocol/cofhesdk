// Neutral, opt-in debug interceptors around every low-level SDK network request.
// Purpose-agnostic: a registered handler can observe, rewrite the URL, mutate the
// request body/init, replace the response, or throw — enabling fault-injection,
// logging, latency simulation, endpoint redirection, etc. without any
// scenario-specific code in the SDK.
//
// Nothing is active unless an interceptor is registered (setCofheDebugInterceptors),
// so this is a no-op in production by default.
//
// Everything in this file is used internally and is not a supported API. It is
// undocumented, may change in any release, and contributor PRs that extend it
// are not accepted. See "Internal APIs" in the repository README.

/**
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export interface CofheRequestContext {
  /** Coarse label for the call site, e.g. 'decrypt' | 'sealoutput' | 'fetchKeys'. */
  op: string;
}

/**
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export interface CofheRequestOverride {
  url?: string;
  init?: RequestInit;
}

/**
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export type CofheOnRequest = (
  url: string,
  init: RequestInit | undefined,
  ctx: CofheRequestContext
) => CofheRequestOverride | void | Promise<CofheRequestOverride | void>;

/**
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export type CofheOnResponse = (
  response: Response,
  ctx: CofheRequestContext
) => Response | void | Promise<Response | void>;

/**
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export interface CofheDebugInterceptors {
  onRequest?: CofheOnRequest;
  onResponse?: CofheOnResponse;
}

const interceptors: CofheDebugInterceptors = {};

/**
 * Register (or clear, with null) the debug interceptors.
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export function setCofheDebugInterceptors(next: CofheDebugInterceptors | null): void {
  interceptors.onRequest = next?.onRequest;
  interceptors.onResponse = next?.onResponse;
}

/**
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export function getCofheDebugInterceptors(): CofheDebugInterceptors {
  return interceptors;
}

/**
 * fetch() wrapper used by all low-level SDK network ops. Applies the registered
 * debug interceptors when present; otherwise behaves exactly like fetch().
 * @internal Used internally; not a supported API. Undocumented and may change in any release.
 */
export async function cofheFetch(
  url: string,
  init?: RequestInit,
  ctx: CofheRequestContext = { op: 'request' }
): Promise<Response> {
  let finalUrl = url;
  let finalInit = init;
  if (interceptors.onRequest) {
    const override = await interceptors.onRequest(finalUrl, finalInit, ctx);
    if (override) {
      if (override.url !== undefined) finalUrl = override.url;
      if (override.init !== undefined) finalInit = override.init;
    }
  }
  let response = await fetch(finalUrl, finalInit);
  if (interceptors.onResponse) {
    const replaced = await interceptors.onResponse(response, ctx);
    if (replaced) response = replaced;
  }
  return response;
}
