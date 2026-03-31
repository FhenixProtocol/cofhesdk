import type { CofheReactLogger } from '@/config';

export let cofheLogger: CofheReactLogger | null | undefined;

/**
 * Configure @cofhe/react internal logger without env vars.
 * Intended for internal use by CofheProvider.
 */
export function setReactLogger(logger: CofheReactLogger | null | undefined): void {
  cofheLogger = logger;
}
