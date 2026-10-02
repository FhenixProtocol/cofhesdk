import { beforeEach, describe, it, expect, vi } from 'vitest';
import { acps } from '../acps.js';

type ScopeOpts = {
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

const acpConfig = {
  defaultRevoker: { [CHAIN]: REVOKER },
  defaultContractScopes: { [CHAIN]: [CONTRACT_A] },
};

describe('applyACPDefaults', () => {
  beforeEach(() => {
    acps.clearAclServedAddresses();
  });

  it('uses the exact chain block timestamp for an ACL-served revoker', async () => {
    const latestBlockTimestamp = 1_700_000_000;
    const publicClient = {
      readContract: vi.fn(({ functionName }: { functionName: string }) => {
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
        if (functionName === 'acl') return Promise.resolve(ACL);
        if (functionName === 'defaultRevokerContract') return Promise.resolve(ACL_REVOKER);
        return Promise.reject(new Error(`unexpected ACL read: ${functionName}`));
      }),
      getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(Number.MAX_SAFE_INTEGER) + 1n }),
    } as any;

    await expect(acps.applyACPDefaultsFromChain(opts({}), undefined, publicClient, CHAIN)).rejects.toThrow(
      /ACP revokerData cannot represent the chain block timestamp .* as a safe integer/
    );
  });

  it('preserves the pure helper local-clock timestamp fallback', () => {
    const before = Math.round(Date.now() / 1000);
    const result = acps.applyACPDefaults(opts({}), acpConfig, CHAIN);
    expect(result.revokerContract).toBe(REVOKER);
    expect(result.revokerData).toBeGreaterThanOrEqual(before - 60);
    expect(result.revokerData).toBeLessThanOrEqual(Math.round(Date.now() / 1000) - 59);
  });

  it('does not override an explicit revoker pair', () => {
    const result = acps.applyACPDefaults({ revokerData: 42, revokerContract: CONTRACT_A }, acpConfig, CHAIN);
    expect(result.revokerData).toBe(42);
    expect(result.revokerContract).toBe(CONTRACT_A);
  });

  it('injects default contract scopes when no scope options given', () => {
    const result = acps.applyACPDefaults(opts({}), acpConfig, CHAIN);
    expect(result.contracts).toEqual([CONTRACT_A]);
  });

  it('does not inject scopes when the caller provides any scope option (incl. explicit scope)', () => {
    expect(acps.applyACPDefaults(opts({ scope: 0 }), acpConfig, CHAIN).contracts).toBeUndefined();
    expect(acps.applyACPDefaults(opts({ handles: [1n] }), acpConfig, CHAIN).contracts).toBeUndefined();
    expect(acps.applyACPDefaults(opts({ contracts: [] }), acpConfig, CHAIN).contracts).toEqual([]);
  });

  it('no-op for chains without defaults and for missing config', () => {
    expect(acps.applyACPDefaults(opts({}), acpConfig, 999)).toEqual({});
    expect(acps.applyACPDefaults(opts({}), undefined, CHAIN)).toEqual({});
  });
});
