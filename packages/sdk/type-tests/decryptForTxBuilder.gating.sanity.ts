import type { DecryptForTxBuilder } from '../core/decrypt/decryptForTxBuilder.js';

// This file exists to sanity-check the type gating in-editor.
// If the brand works, the following should be a type error.

declare const b: DecryptForTxBuilder<'unset'>;

// @ts-expect-error execute() not allowed before withPermit/withoutPermit
b.execute();

declare const bw: DecryptForTxBuilder<'with-permit'>;
declare const bn: DecryptForTxBuilder<'without-permit'>;

// Cannot switch modes once selected
// @ts-expect-error cannot call withoutPermit() after withPermit()
bw.withoutPermit();
// @ts-expect-error cannot call withPermit() after withoutPermit()
bn.withPermit();

// Repeated selection is also disallowed
// @ts-expect-error cannot call withPermit() twice
bw.withPermit();
// @ts-expect-error cannot call withoutPermit() twice
bn.withoutPermit();
