import type { CofheClient } from '../core/clientTypes.js';

// This file is compiled by `pnpm -C packages/sdk check:types`.
// It ensures TypeScript prevents calling execute() before selecting a permit mode.

declare const client: CofheClient;
declare const ctHash: bigint | string;

// NOTE: This file name matches Vitest defaults (`*.test.ts`), and some CI runs may accidentally
// execute it as a runtime test. Keep the type assertions, but ensure nothing runs at runtime.
if (false) {
  // @ts-expect-error Must call withPermit(...) or withoutPermit() before execute()
  client.decryptForTx(ctHash).execute();

  // @ts-expect-error Still unset after setChainId/setAccount
  client.decryptForTx(ctHash).setChainId(1).setAccount('0x0000000000000000000000000000000000000000').execute();

  // OK: withPermit() uses active permit
  client.decryptForTx(ctHash).withPermit().execute();

  // @ts-expect-error Explicit undefined is not allowed; use withPermit() for active permit
  client.decryptForTx(ctHash).withPermit(undefined);

  // OK: withPermit(hash)
  client.decryptForTx(ctHash).withPermit('0xdeadbeef').execute();

  // OK: withoutPermit() uses global allowance
  client.decryptForTx(ctHash).withoutPermit().execute();
}
