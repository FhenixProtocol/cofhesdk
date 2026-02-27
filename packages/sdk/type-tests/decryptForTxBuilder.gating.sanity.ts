import type { DecryptForTxBuilder } from '../core/decrypt/decryptForTxBuilder.js';

// This file exists to sanity-check the type gating in-editor.
// If the brand works, the following should be a type error.

declare const b: DecryptForTxBuilder<'unset'>;

// @ts-expect-error execute() not allowed before withPermit/withoutPermit
b.execute();
