/**
 * Checks if we're in production by checking environment variables exposed by
 * Node.js, webpack, and other process-compatible bundlers.
 */
export const isProduction = (): boolean => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-undef
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return false;
  }

  // Default to hiding debug in library context.
  return true;
};
