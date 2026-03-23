/**
 * Checks if we're in production by checking multiple environment variable sources
 * Supports: process.env (Node.js/webpack), import.meta.env (Vite), and other common patterns
 */
export const isProduction = (): boolean => {
  // Check process.env (Node.js, webpack, etc.)
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-undef
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return false;
  }

  // Check import.meta.env (Vite)
  if (typeof import.meta !== 'undefined') {
    //     {
    //     "BASE_URL": "/",
    //     "DEV": true,
    //     "MODE": "development",
    //     "PROD": false,
    //     "SSR": false
    // }
    const metaEnv = (import.meta as any).env;

    // ONLY if ALL flags indicate development AND prod flag doesn't indicate prod, treat as development
    if (metaEnv && metaEnv.MODE === 'development' && metaEnv.DEV === true && metaEnv.PROD === false) {
      return false;
    }
  }

  // Default to hiding debug in library context
  return true;
};
