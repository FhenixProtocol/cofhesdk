import { type ACP, type ACPPublic } from './types.js';
import { ACPUtils } from './permit.js';

/** The permit object as decryption-backend request bodies carry it. */
export type WirePermit = ACPPublic;

export const toWirePermit = (acp: ACP): WirePermit => ACPUtils.getPublic(acp, true);
