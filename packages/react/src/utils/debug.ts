import type { CofheReactLoggerResolved } from '@/config';

const noopCofheReactLoggerMethod = (..._args: unknown[]) => {};

const NOOP_LOGGER = {
  log: noopCofheReactLoggerMethod,
  warn: noopCofheReactLoggerMethod,
  debug: noopCofheReactLoggerMethod,
  error: noopCofheReactLoggerMethod,
} satisfies CofheReactLoggerResolved;

export let cofheLogger: CofheReactLoggerResolved = NOOP_LOGGER;

/**
 * Configure @cofhe/react internal logger without env vars.
 * Intended for internal use by CofheProvider.
 */
export function setReactLogger(logger: CofheReactLoggerResolved | null | undefined): void {
  cofheLogger = logger ?? NOOP_LOGGER;
}
