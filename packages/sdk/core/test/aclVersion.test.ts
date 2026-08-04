import { describe, it, expect, beforeEach } from 'vitest';
import type { PublicClient } from 'viem';
import { permits } from '../permits.js';

const ACL_ADDRESS = '0x4444444444444444444444444444444444444444';

/** A publicClient stub whose ACL serves the given EIP-712 domain version. */
const clientWithDomainVersion = (version: string, calls: string[] = []): PublicClient =>
  ({
    readContract: async ({ functionName }: { functionName: string }) => {
      calls.push(functionName);
      if (functionName === 'acl') return ACL_ADDRESS;
      if (functionName === 'eip712Domain') {
        return ['0x0f', 'ACL', version, 1n, ACL_ADDRESS, `0x${'00'.repeat(32)}`, []];
      }
      throw new Error(`unexpected read: ${functionName}`);
    },
  }) as unknown as PublicClient;

const failingClient = (): PublicClient =>
  ({
    readContract: async () => {
      throw new Error('network down');
    },
  }) as unknown as PublicClient;

describe('getAclVersion', () => {
  beforeEach(() => {
    permits.clearAclVersions();
  });

  it('domain version "1" resolves to v2, "2" to acp', async () => {
    expect(await permits.getAclVersion(clientWithDomainVersion('1'), 101)).to.equal('v2');
    expect(await permits.getAclVersion(clientWithDomainVersion('2'), 102)).to.equal('acp');
  });

  it('caches per chainId', async () => {
    const calls: string[] = [];
    const client = clientWithDomainVersion('1', calls);
    await permits.getAclVersion(client, 101);
    const callsAfterFirst = calls.length;
    await permits.getAclVersion(client, 101);
    expect(calls.length).to.equal(callsAfterFirst);
  });

  it('config override wins without touching the chain', async () => {
    const calls: string[] = [];
    const client = clientWithDomainVersion('1', calls);
    expect(await permits.getAclVersion(client, 101, 'acp')).to.equal('acp');
    expect(calls.length).to.equal(0);
  });

  it('a failed probe resolves to acp and is not cached', async () => {
    expect(await permits.getAclVersion(failingClient(), 101)).to.equal('acp');
    // recovers once the chain is reachable
    expect(await permits.getAclVersion(clientWithDomainVersion('1'), 101)).to.equal('v2');
  });
});
