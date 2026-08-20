import type { DecryptForTxBuilderSelected, DecryptForTxBuilderUnset } from '../core/decrypt/decryptForTxBuilder.js';

// This file exists to sanity-check the type gating in-editor.
// If the brand works, the following should be a type error.

declare const b: DecryptForTxBuilderUnset;

// @ts-expect-error execute() not allowed before withACP/withoutACP
b.execute();

declare const bw: DecryptForTxBuilderSelected;
declare const bn: DecryptForTxBuilderSelected;

// Selected builders expose execute()
bw.execute();
bn.execute();

// Cannot switch modes once selected (selection methods are not present)
// @ts-expect-error cannot call withoutACP() after selection
bw.withoutACP();
// @ts-expect-error cannot call withACP() after selection
bn.withACP();

// Repeated selection is also disallowed (selection methods are not present)
// @ts-expect-error cannot call withACP() twice
bw.withACP();
// @ts-expect-error cannot call withoutACP() twice
bn.withoutACP();
