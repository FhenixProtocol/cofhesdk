import type { CofheClient } from '../core/clientTypes.js';

// This file is compiled by `pnpm -C packages/sdk check:types`.
// It ensures TypeScript prevents calling execute() before selecting a acp mode.

declare const client: CofheClient;
declare const ctHash: bigint | string;

// NOTE: This file name matches Vitest defaults (`*.test.ts`), and some CI runs may accidentally
// execute it as a runtime test. Keep the type assertions, but ensure nothing runs at runtime.
if (false) {
  // @ts-expect-error Must call withACP(...) or withoutACP() before execute()
  client.decryptForTx(ctHash).execute();

  // @ts-expect-error Still unset after setChainId/setAccount
  client.decryptForTx(ctHash).setChainId(1).setAccount('0x0000000000000000000000000000000000000000').execute();

  // OK: withACP() uses active acp
  client.decryptForTx(ctHash).withACP().execute();

  // @ts-expect-error Explicit undefined is not allowed; use withACP() for active acp
  client.decryptForTx(ctHash).withACP(undefined);

  // OK: withACP(hash)
  client.decryptForTx(ctHash).withACP('0xdeadbeef').execute();

  // OK: withoutACP() uses global allowance
  client.decryptForTx(ctHash).withoutACP().execute();
}
