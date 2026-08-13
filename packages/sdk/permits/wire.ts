import { type ACP, type ACPPublic } from './types';
import { ACPUtils } from './permit';

/** The permit object as decryption-backend request bodies carry it. */
export type WirePermit = ACPPublic;

export const toWirePermit = (acp: ACP): WirePermit => ACPUtils.getPublic(acp, true);
