import { NOOP_COFHE_REACT_LOGGER, type CofheReactLoggerResolved } from '@/config';

export let cofheLogger: CofheReactLoggerResolved = NOOP_COFHE_REACT_LOGGER;

/**
 * Configure @cofhe/react internal logger without env vars.
 * Intended for internal use by CofheProvider.
 */
export function setReactLogger(logger: CofheReactLoggerResolved | null | undefined): void {
  cofheLogger = logger ?? NOOP_COFHE_REACT_LOGGER;
}
