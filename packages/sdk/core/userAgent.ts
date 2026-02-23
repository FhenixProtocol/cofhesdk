type UserAgentGlobals = {
  __COFHE_SDK_NAME__?: string;
  __COFHE_SDK_VERSION__?: string;
};

declare const globalThis: unknown;
declare const self: unknown;
declare const window: unknown;
declare const global: unknown;

const COFHE_CLIEND_HEADER_KEY = 'X-COFHE-SDK';

type AnyGlobalObject = Record<string, unknown>;

function getGlobalObject(): AnyGlobalObject {
  if (typeof globalThis !== 'undefined') return globalThis as AnyGlobalObject;
  if (typeof self !== 'undefined') return self as AnyGlobalObject;
  if (typeof window !== 'undefined') return window as AnyGlobalObject;
  if (typeof global !== 'undefined') return global as AnyGlobalObject;
  return {};
}

function getGlobals(): UserAgentGlobals {
  return getGlobalObject() as UserAgentGlobals;
}

export function getSdkUserAgent(): string {
  const globals = getGlobals();
  const name = globals.__COFHE_SDK_NAME__ ?? '@cofhe/sdk';
  const version = globals.__COFHE_SDK_VERSION__ ?? '0.0.0';
  return `${name}/${version}`;
}

function isNodeRuntime(): boolean {
  const isNode = typeof process !== 'undefined' && typeof process.versions?.node === 'string';
  if (!isNode) return false;

  const g = getGlobalObject() as Record<string, unknown>;

  // Guard against bundler/polyfill environments (e.g. browser tests) that provide a fake `process`.
  if (typeof g.window !== 'undefined') return false;
  if (typeof g.document !== 'undefined') return false;

  // Guard against browser workers.
  if (typeof (g as Record<string, unknown>).importScripts === 'function') return false;

  return true;
}

/**
 * Returns a headers object containing the SDK user agent.
 *
 * Note: Browsers restrict setting the `User-Agent` header and extra custom headers may break CORS.
 * We only set `User-Agent` in Node runtimes.
 */
export function getSdkUserAgentHeaders(): Record<string, string> {
  const userAgent = getSdkUserAgent();

  if (isNodeRuntime()) {
    return {
      'User-Agent': userAgent,
      [COFHE_CLIEND_HEADER_KEY]: userAgent,
    };
  }

  return {
    [COFHE_CLIEND_HEADER_KEY]: userAgent,
  };
}
