import type { DecryptForTxBuilderSelected, DecryptForTxBuilderUnset } from '../core/decrypt/decryptForTxBuilder.js';

// This file exists to sanity-check the type gating in-editor.
// If the brand works, the following should be a type error.

declare const b: DecryptForTxBuilderUnset;

// @ts-expect-error execute() not allowed before withPermit/withoutPermit
b.execute();

declare const bw: DecryptForTxBuilderSelected;
declare const bn: DecryptForTxBuilderSelected;

// Selected builders expose execute()
bw.execute();
bn.execute();

// Cannot switch modes once selected (selection methods are not present)
// @ts-expect-error cannot call withoutPermit() after selection
bw.withoutPermit();
// @ts-expect-error cannot call withPermit() after selection
bn.withPermit();

// Repeated selection is also disallowed (selection methods are not present)
// @ts-expect-error cannot call withPermit() twice
bw.withPermit();
// @ts-expect-error cannot call withoutPermit() twice
bn.withoutPermit();
