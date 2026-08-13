import { type ACP, type ACPPublic } from './types.js';
import { ACPUtils } from './permit.js';

/** The permit object as decryption-backend request bodies carry it. */
export type WirePermit = ACPPublic;

export const toWirePermit = (acp: ACP): WirePermit => ACPUtils.getPublic(acp, true);

/** Request-body entry for a wire permit — ACP-era backends read the "acp" key. */
export const wirePermitBody = <T extends object>(wire: T): { acp: T } => ({ acp: wire });
