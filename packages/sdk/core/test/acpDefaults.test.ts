import { beforeEach, describe, it, expect, vi } from 'vitest';
import { acps } from '../acps.js';
import { clearTaskManagerAddressCache } from '../taskManager.js';

type ScopeOpts = {
  expiration?: number;
  revokerData?: number;
  revokerContract?: string;
  scope?: number;
  contracts?: string[];
  handles?: bigint[];
};
const opts = (o: ScopeOpts): ScopeOpts => o;

const CHAIN = 31337;
const REVOKER = '0x00000000000000000000000000000000000000aa' as `0x${string}`;
const ACL_REVOKER = '0x00000000000000000000000000000000000000cc' as `0x${string}`;
const CONTRACT_A = '0x00000000000000000000000000000000000000bb' as `0x${string}`;
const ACL = '0x00000000000000000000000000000000000000dd' as `0x${string}`;
const TM = '0x0000000000000000000000000000000000005000' as `0x${string}`;

const acpConfig = {
  defaultRevoker: { [CHAIN]: REVOKER },
  defaultContractScopes: { [CHAIN]: [CONTRACT_A] },
};

describe('applyACPDefaults', () => {
  beforeEach(() => {
    acps.clearAclServedAddresses();
    clearTaskManagerAddressCache();
  });

  it('uses the exact chain block timestamp for an ACL-served revoker', async () => {
    const latestBlockTimestamp = 1_700_000_000;
    const publicClient = {
      readContract: vi.fn(({ functionName }: { functionName: string }) => {
        if (functionName === 'getTm') return Promise.resolve(TM);
        if (functionName === 'acl') return Promise.resolve(ACL);
        if (functionName === 'defaultRevokerContract') return Promise.resolve(ACL_REVOKER);
        return Promise.reject(new Error(`unexpected ACL read: ${functionName}`));
      }),
      getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(latestBlockTimestamp) }),
    } as any;

    const result = await acps.applyACPDefaultsFromChain(opts({}), undefined, publicClient, CHAIN);

    expect(publicClient.getBlock).toHaveBeenCalledWith();
    expect(result.revokerContract).toBe(ACL_REVOKER);
    expect(result.revokerData).toBe(latestBlockTimestamp);
  });

  it('prefers configured revoker over ACL but still uses the latest block timestamp', async () => {
    const latestBlockTimestamp = 1_700_000_001;
    const publicClient = {
      readContract: vi.fn(({ functionName }: { functionName: string }) => {
        if (functionName === 'getTm') return Promise.resolve(TM);
        if (functionName === 'acl') return Promise.resolve(ACL);
        if (functionName === 'defaultRevokerContract') return Promise.resolve(ACL_REVOKER);
        return Promise.reject(new Error(`unexpected ACL read: ${functionName}`));
      }),
      getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(latestBlockTimestamp) }),
    } as any;

    const result = await acps.applyACPDefaultsFromChain(opts({}), acpConfig, publicClient, CHAIN);

    expect(publicClient.readContract).not.toHaveBeenCalled();
    expect(publicClient.getBlock).toHaveBeenCalledWith();
    expect(result.revokerContract).toBe(REVOKER);
    expect(result.revokerData).toBe(latestBlockTimestamp);
  });

  it('avoids getBlock for explicit revoker options', async () => {
    const publicClient = {
      readContract: vi.fn(),
      getBlock: vi.fn(),
    } as any;

    const result = await acps.applyACPDefaultsFromChain(
      opts({ revokerData: 42, revokerContract: CONTRACT_A }),
      acpConfig,
      publicClient,
      CHAIN
    );

    expect(publicClient.readContract).not.toHaveBeenCalled();
    expect(publicClient.getBlock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ revokerData: 42, revokerContract: CONTRACT_A });
  });

  it('avoids getBlock when neither config nor ACL provide a revoker', async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error('no ACL deployment')),
      getBlock: vi.fn(),
    } as any;

    const result = await acps.applyACPDefaultsFromChain(opts({}), undefined, publicClient, CHAIN);

    expect(publicClient.getBlock).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('rejects a block timestamp outside JavaScript safe integer range', async () => {
    const publicClient = {
      readContract: vi.fn(({ functionName }: { functionName: string }) => {
        if (functionName === 'getTm') return Promise.resolve(TM);
        if (functionName === 'acl') return Promise.resolve(ACL);
        if (functionName === 'defaultRevokerContract') return Promise.resolve(ACL_REVOKER);
        return Promise.reject(new Error(`unexpected ACL read: ${functionName}`));
      }),
      getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(Number.MAX_SAFE_INTEGER) + 1n }),
    } as any;

    await expect(acps.applyACPDefaultsFromChain(opts({}), undefined, publicClient, CHAIN)).rejects.toThrow(
      /ACP defaults cannot represent the chain block timestamp .* as a safe integer/
    );
  });

  it('sets the expiration that many seconds after the block it reads for the revoker', async () => {
    const latestBlockTimestamp = 1_700_000_002;
    const publicClient = {
      readContract: vi.fn(),
      getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(latestBlockTimestamp) }),
    } as any;

    const result = await acps.applyACPDefaultsFromChain(opts({}), acpConfig, publicClient, CHAIN, 3600);

    expect(publicClient.getBlock).toHaveBeenCalledTimes(1);
    expect(result.expiration).toBe(latestBlockTimestamp + 3600);
    expect(result.revokerData).toBe(latestBlockTimestamp);
  });

  it('reads the block for the expiration when no revoker is injected', async () => {
    const result = await acps.applyACPDefaultsFromChain(opts({}), undefined, noAclClient(), CHAIN, 3600);
    expect(result).toEqual({ expiration: 1_700_000_000 + 3600 });
  });

  it('keeps an explicit expiration and avoids getBlock when nothing else needs it', async () => {
    const publicClient = {
      readContract: vi.fn(),
      getBlock: vi.fn(),
    } as any;

    const result = await acps.applyACPDefaultsFromChain(
      opts({ expiration: 42, revokerData: 42, revokerContract: CONTRACT_A }),
      acpConfig,
      publicClient,
      CHAIN,
      3600
    );

    expect(publicClient.getBlock).not.toHaveBeenCalled();
    expect(result.expiration).toBe(42);
  });

  it('injects default contract scopes when no scope options given', async () => {
    const result = await acps.applyACPDefaultsFromChain(opts({}), acpConfig, noAclClient(), CHAIN);
    expect(result.contracts).toEqual([CONTRACT_A]);
  });

  it('does not inject scopes when the caller provides any scope option (incl. explicit scope)', async () => {
    const apply = (o: ScopeOpts) => acps.applyACPDefaultsFromChain(o, acpConfig, noAclClient(), CHAIN);
    expect((await apply(opts({ scope: 0 }))).contracts).toBeUndefined();
    expect((await apply(opts({ handles: [1n] }))).contracts).toBeUndefined();
    expect((await apply(opts({ contracts: [] }))).contracts).toEqual([]);
  });

  it('no-op for chains without defaults and for missing config', async () => {
    expect(await acps.applyACPDefaultsFromChain(opts({}), acpConfig, noAclClient(), 999)).toEqual({});
    expect(await acps.applyACPDefaultsFromChain(opts({}), undefined, noAclClient(), CHAIN)).toEqual({});
  });
});

/** A chain with no ACL deployment: the ACL lookup serves no revoker. */
function noAclClient() {
  return {
    readContract: vi.fn().mockRejectedValue(new Error('no ACL deployment')),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n }),
  } as any;
}
