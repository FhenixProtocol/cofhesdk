type DebugEnvValue = string | number | boolean | undefined | null;

function isTruthy(value: DebugEnvValue): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function getGlobalDebugFlag(): unknown {
  return (globalThis as any)?.__COFHE_REACT_DEBUG__;
}

function getProcessEnv(key: string): DebugEnvValue {
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-undef
  if (typeof process !== 'undefined') return (process.env as any)?.[key];
  return undefined;
}

function getImportMetaEnv(key: string): DebugEnvValue {
  if (typeof import.meta === 'undefined') return undefined;
  return (import.meta as any)?.env?.[key];
}

const DEBUG_KEYS = [
  // Generic
  'COFHE_REACT_DEBUG',
  // Vite
  'VITE_COFHE_REACT_DEBUG',
  // Next.js
  'NEXT_PUBLIC_COFHE_REACT_DEBUG',
  // CRA
  'REACT_APP_COFHE_REACT_DEBUG',
] as const;

export function isReactDebugEnabled(): boolean {
  if (isTruthy(getGlobalDebugFlag() as any)) return true;

  for (const key of DEBUG_KEYS) {
    if (isTruthy(getProcessEnv(key))) return true;
    if (isTruthy(getImportMetaEnv(key))) return true;
  }

  return false;
}

export function debugLog(...args: unknown[]): void {
  if (!isReactDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (!isReactDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
}

export function debugDebug(...args: unknown[]): void {
  if (!isReactDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(...args);
}
