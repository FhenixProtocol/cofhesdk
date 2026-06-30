// Neutral, opt-in debug interceptors around every low-level SDK network request.
// Purpose-agnostic: a registered handler can observe, rewrite the URL, mutate the
// request body/init, replace the response, or throw — enabling fault-injection,
// logging, latency simulation, endpoint redirection, etc. without any
// scenario-specific code in the SDK.
//
// Nothing is active unless an interceptor is registered (setCofheDebugInterceptors),
// so this is a no-op in production by default.

export interface CofheRequestContext {
  /** Coarse label for the call site, e.g. 'decrypt' | 'sealoutput' | 'fetchKeys'. */
  op: string;
}

export interface CofheRequestOverride {
  url?: string;
  init?: RequestInit;
}

export type CofheOnRequest = (
  url: string,
  init: RequestInit | undefined,
  ctx: CofheRequestContext
) => CofheRequestOverride | void | Promise<CofheRequestOverride | void>;

export type CofheOnResponse = (
  response: Response,
  ctx: CofheRequestContext
) => Response | void | Promise<Response | void>;

export interface CofheDebugInterceptors {
  onRequest?: CofheOnRequest;
  onResponse?: CofheOnResponse;
}

const interceptors: CofheDebugInterceptors = {};

/** Register (or clear, with null) the debug interceptors. */
export function setCofheDebugInterceptors(next: CofheDebugInterceptors | null): void {
  interceptors.onRequest = next?.onRequest;
  interceptors.onResponse = next?.onResponse;
}

export function getCofheDebugInterceptors(): CofheDebugInterceptors {
  return interceptors;
}

/**
 * fetch() wrapper used by all low-level SDK network ops. Applies the registered
 * debug interceptors when present; otherwise behaves exactly like fetch().
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
