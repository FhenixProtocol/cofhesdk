import { ContractFunctionRevertedError, HttpRequestError, parseAbi } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearTaskManagerAddressCache } from '../../core/taskManager.js';
import { clearAclServedAddresses, getAclServedAddresses } from '../onchain-utils.js';

const CHAIN_ID = 421614;
const TASK_MANAGER = '0x0000000000000000000000000000000000005000';
const ACL = '0x00000000000000000000000000000000000000dd';
const REVOKER = '0x00000000000000000000000000000000000000cc';
const REGISTRY = '0x00000000000000000000000000000000000000ee';

const GETTERS_ABI = parseAbi([
  'function defaultRevokerContract() view returns (address)',
  'function shareRegistry() view returns (address)',
]);

function clientWithGetters(getter: (functionName: string) => Promise<unknown>) {
  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getTm') return TASK_MANAGER;
      if (functionName === 'acl') return ACL;
      return getter(functionName);
    }),
  } as any;
}

describe('getAclServedAddresses', () => {
  beforeEach(() => {
    clearAclServedAddresses();
    clearTaskManagerAddressCache();
  });

  it('does not cache a transient failure of the ACL getters', async () => {
    let down = true;
    const publicClient = clientWithGetters(async (functionName) => {
      if (down) throw new HttpRequestError({ url: 'http://rpc', status: 429 });
      return functionName === 'defaultRevokerContract' ? REVOKER : REGISTRY;
    });

    expect(await getAclServedAddresses(publicClient, CHAIN_ID)).toEqual({
      defaultRevoker: undefined,
      shareRegistry: undefined,
    });

    down = false;
    expect(await getAclServedAddresses(publicClient, CHAIN_ID)).toEqual({
      defaultRevoker: REVOKER,
      shareRegistry: REGISTRY,
    });
  });

  it('caches a pre-upgrade ACL whose getters revert', async () => {
    const publicClient = clientWithGetters(async (functionName) => {
      throw new ContractFunctionRevertedError({ abi: GETTERS_ABI, functionName, data: '0x' });
    });

    const expected = { defaultRevoker: undefined, shareRegistry: undefined };
    expect(await getAclServedAddresses(publicClient, CHAIN_ID)).toEqual(expected);
    const calls = publicClient.readContract.mock.calls.length;

    expect(await getAclServedAddresses(publicClient, CHAIN_ID)).toEqual(expected);
    expect(publicClient.readContract.mock.calls.length).toBe(calls);
  });
});
