import { SDK_NAME, SDK_VERSION } from './version.js';

declare const globalThis: unknown;

export const COFHE_CLIENT_HEADER_KEY = 'X-COFHE-PACKAGE';

export function getSdkUserAgent(): string {
  return `${SDK_NAME}/${SDK_VERSION}`;
}

function isNodeRuntime(): boolean {
  const isNode = typeof process !== 'undefined' && typeof process.versions?.node === 'string';
  if (!isNode) return false;

  // Guard against bundler/polyfill environments (e.g. browser tests) that provide a fake `process`.
  const g = (typeof globalThis !== 'undefined' ? (globalThis as unknown as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  if (typeof g.window !== 'undefined') return false;
  if (typeof g.document !== 'undefined') return false;

  // Guard against browser workers.
  if (typeof g.importScripts === 'function') return false;

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
      [COFHE_CLIENT_HEADER_KEY]: userAgent,
    };
  }

  return {
    [COFHE_CLIENT_HEADER_KEY]: userAgent,
  };
}
