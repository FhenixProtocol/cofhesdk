import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PublicClient } from 'viem';

import { getTaskManagerAddress, clearTaskManagerAddressCache } from '../taskManager.js';
import { COFHE_ADDRESS_BOOK_ADDRESS, TASK_MANAGER_ID } from '../consts.js';
import { CofheErrorCode, isCofheError } from '../error.js';

const TM = '0x0000000000000000000000000000000000005000';

const fakeClient = (readContract: (...args: any[]) => Promise<unknown>, chainId = 31337) =>
  ({ chain: { id: chainId }, readContract: vi.fn(readContract) }) as unknown as PublicClient & {
    readContract: ReturnType<typeof vi.fn>;
  };

describe('getTaskManagerAddress', () => {
  beforeEach(() => clearTaskManagerAddressCache());

  it('resolves getTm(TASK_MANAGER_ID) on the CoFHEAddressBook', async () => {
    const client = fakeClient(async () => TM);

    expect(await getTaskManagerAddress(client)).to.equal(TM);
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: COFHE_ADDRESS_BOOK_ADDRESS,
        functionName: 'getTm',
        args: [TASK_MANAGER_ID],
      })
    );
  });

  it('caches per chainId and shares an in-flight lookup', async () => {
    const client = fakeClient(async () => TM);

    await Promise.all([getTaskManagerAddress(client), getTaskManagerAddress(client)]);
    await getTaskManagerAddress(client);
    expect(client.readContract).toHaveBeenCalledTimes(1);

    await getTaskManagerAddress(client, 11155111);
    expect(client.readContract).toHaveBeenCalledTimes(2);
  });

  it('throws TASK_MANAGER_UNRESOLVED and does not cache the failure', async () => {
    let calls = 0;
    const client = fakeClient(async () => {
      calls += 1;
      if (calls === 1) throw new Error('returned no data ("0x")');
      return TM;
    });

    const error = await getTaskManagerAddress(client).catch((e: unknown) => e);
    expect(isCofheError(error)).to.equal(true);
    expect((error as any).code).to.equal(CofheErrorCode.TaskManagerUnresolved);

    expect(await getTaskManagerAddress(client)).to.equal(TM);
    expect(client.readContract).toHaveBeenCalledTimes(2);
  });
});
