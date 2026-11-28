import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { ACP_REVOKER_ABI, ACP_SHARE_REGISTRY_ABI, computeShareId, encodeShareMetadata, toChainShare } from '@/acps';
import { UNLABELLED } from '../../acps/share-metadata';
import { createMockACP } from '../../acps/test-utils';
import { acps } from '../acps';

/**
 * The sharing writes built but not sent: what a caller that sends through its own path
 * (simulation, transaction store) gets, and what the plain senders send. No chain involved.
 */

const REGISTRY = '0x00000000000000000000000000000000000000A1';
const REVOKER = '0x00000000000000000000000000000000000000B2';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const HANDLE: Hex = `0x${'1'.repeat(64)}`;

const signedSharing = (overrides: Parameters<typeof createMockACP>[0] = {}) =>
  createMockACP({ type: 'sharing', recipient: ALICE, issuerSignature: '0x1234', ...overrides });

describe('prepareShareOnChain', () => {
  it('a signed sharing acp: the registry share call with the acp and its metadata, and its share id', async () => {
    const acp = await signedSharing();
    const { write, shareId } = acps.prepareShareOnChain(acp, REGISTRY);
    expect(write).toStrictEqual({
      address: REGISTRY,
      abi: ACP_SHARE_REGISTRY_ABI,
      functionName: 'share',
      args: [toChainShare(acp), '0x'],
    });
    expect(shareId).toBe(computeShareId(acp));
  });

  it('posts the labels it is given, else the metadata on the acp', async () => {
    const acp = await signedSharing({ handles: [HANDLE] });
    const labelled = acps.prepareShareOnChain(acp, REGISTRY, { labels: [UNLABELLED] });
    expect(labelled.write.args[1]).toBe(encodeShareMetadata([UNLABELLED], { issuer: acp.issuer }));

    const kept = acps.prepareShareOnChain({ ...acp, metadata: '0xdead' }, REGISTRY);
    expect(kept.write.args[1]).toBe('0xdead');
  });

  it('refuses a self acp and an unsigned sharing acp', async () => {
    const self = await createMockACP();
    expect(() => acps.prepareShareOnChain(self, REGISTRY)).toThrow(/only 'sharing' ACPs/);
    const unsigned = await createMockACP({ type: 'sharing', recipient: ALICE });
    expect(() => acps.prepareShareOnChain(unsigned, REGISTRY)).toThrow(/sign it first/);
  });
});

describe('prepareRemoveShare', () => {
  it('the registry removeShare call for the share id', () => {
    expect(acps.prepareRemoveShare(HANDLE, REGISTRY)).toStrictEqual({
      address: REGISTRY,
      abi: ACP_SHARE_REGISTRY_ABI,
      functionName: 'removeShare',
      args: [HANDLE],
    });
  });
});

describe('prepareRevokeACP', () => {
  it('the revoker revokeSingle call for the acp revoker data', async () => {
    const acp = await signedSharing({ revokerContract: REVOKER, revokerData: 42 });
    expect(acps.prepareRevokeACP(acp)).toStrictEqual({
      address: REVOKER,
      abi: ACP_REVOKER_ABI,
      functionName: 'revokeSingle',
      args: [42n],
    });
  });

  it('refuses an acp without a revoker', async () => {
    const acp = await signedSharing();
    expect(() => acps.prepareRevokeACP(acp)).toThrow(/not revocable/);
  });
});
