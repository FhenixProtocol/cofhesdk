type UserAgentGlobals = {
  __COFHE_SDK_NAME__?: string;
  __COFHE_SDK_VERSION__?: string;
};

function getGlobals(): UserAgentGlobals {
  return (typeof globalThis !== 'undefined' ? (globalThis as unknown as UserAgentGlobals) : {}) as UserAgentGlobals;
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

  // Guard against bundler/polyfill environments (e.g. browser tests) that provide a fake `process`.
  if (typeof window !== 'undefined') return false;
  if (typeof document !== 'undefined') return false;

  // Guard against browser workers.
  if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
    return false;
  }

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
      'X-COFHE-SDK': userAgent,
    };
  }

  // In browsers, sending a custom header can trigger a CORS preflight.
  // Since our SDK talks to third-party endpoints, we keep browser requests
  // header-free by default to avoid breaking in real browsers and tests.
  return {
    'X-COFHE-SDK': userAgent,
  };
}
