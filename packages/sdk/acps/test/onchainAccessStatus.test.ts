import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { checkACPValidityOnChain, getACPAccessStatusOnChain } from '../onchain-utils';
import type { ACPPublic } from '../types';

const ACL = '0x00000000000000000000000000000000000000ac';
const ISSUER = '0x00000000000000000000000000000000000000b0';

const acp: ACPPublic = {
  issuer: ISSUER,
  expiration: 2_000_000_000,
  recipient: '0x00000000000000000000000000000000000000a1',
  revokerData: 1,
  revokerContract: '0x00000000000000000000000000000000000000cc',
  scope: 2,
  contracts: [],
  handles: [],
  sealingKey: `0x${'0'.repeat(64)}`,
  issuerSignature: '0x01',
  recipientSignature: '0x02',
} as unknown as ACPPublic;

/**
 * A revert as a viem copy OTHER than the SDK one reports it: the same shape, but no class
 * identity the SDK could match with `instanceof`.
 */
function foreignRevert(errorName: string) {
  const reverted = { name: 'ContractFunctionRevertedError', data: { errorName } };
  return Object.assign(new Error(`The contract function reverted: ${errorName}`), {
    walk: (fn: (e: unknown) => boolean) => (fn(reverted) ? reverted : null),
  });
}

function client({ simulate, reads = {} }: { simulate?: () => unknown; reads?: Record<string, () => unknown> }) {
  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'acl') return ACL;
      const read = reads[functionName];
      if (!read) throw new Error(`unexpected read ${functionName}`);
      return read();
    }),
    simulateContract: vi.fn(async () => simulate?.()),
  } as unknown as PublicClient;
}

describe('getACPAccessStatusOnChain', () => {
  it('returns valid when the ACL accepts the ACP', async () => {
    expect(await getACPAccessStatusOnChain(acp, client({}))).toBe('valid');
  });

  it.each([
    ['PermissionInvalid_Expired', 'expired'],
    ['PermissionInvalid_Disabled', 'revoked'],
    ['PermissionInvalid_IssuerSignature', 'invalid-issuer-signature'],
    ['PermissionInvalid_RecipientSignature', 'invalid-recipient-signature'],
  ])('maps %s to %s, even from another viem copy', async (errorName, status) => {
    const publicClient = client({
      simulate: () => {
        throw foreignRevert(errorName);
      },
    });
    expect(await getACPAccessStatusOnChain(acp, publicClient)).toBe(status);
  });

  it('tells out-of-scope from issuer-not-allowed with the issuer own allowance', async () => {
    const outOfScope = client({ reads: { isAllowedWithPermission: () => false, isAllowed: () => true } });
    const notAllowed = client({ reads: { isAllowedWithPermission: () => false, isAllowed: () => false } });
    const allowed = client({ reads: { isAllowedWithPermission: () => true } });
    expect(await getACPAccessStatusOnChain(acp, outOfScope, 1n)).toBe('out-of-scope');
    expect(await getACPAccessStatusOnChain(acp, notAllowed, '0x01')).toBe('issuer-not-allowed');
    expect(await getACPAccessStatusOnChain(acp, allowed, 1n)).toBe('allowed');
  });

  it('maps a revert on the handle check too', async () => {
    const publicClient = client({
      reads: {
        isAllowedWithPermission: () => {
          throw foreignRevert('PermissionInvalid_Disabled');
        },
      },
    });
    expect(await getACPAccessStatusOnChain(acp, publicClient, 1n)).toBe('revoked');
  });

  it('still throws what is not an ACL revert', async () => {
    const publicClient = client({
      simulate: () => {
        throw new Error('fetch failed');
      },
    });
    await expect(getACPAccessStatusOnChain(acp, publicClient)).rejects.toThrow('fetch failed');
  });
});

describe('checkACPValidityOnChain', () => {
  it('names the revert from another viem copy instead of rethrowing it raw', async () => {
    const publicClient = client({
      simulate: () => {
        throw foreignRevert('PermissionInvalid_Disabled');
      },
    });
    await expect(checkACPValidityOnChain(acp, publicClient)).rejects.toThrow(/^PermissionInvalid_Disabled$/);
  });
});
