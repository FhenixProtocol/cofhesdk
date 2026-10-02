import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type PublicClient } from 'viem';
import { decodeShareMetadata } from '../decode';
import { verifyShareLabels } from '../verify';
import { LIVE_RPC, SAMPLE } from './fixtures';

/**
 * The real sample against Arbitrum Sepolia. Runs only with SHARE_METADATA_LIVE_RPC set, e.g.
 * SHARE_METADATA_LIVE_RPC=https://sepolia-rollup.arbitrum.io/rpc pnpm vitest run acps/share-metadata
 */
describe.skipIf(!LIVE_RPC)('share metadata against Arbitrum Sepolia', () => {
  // the fallback only keeps a skipped suite constructible
  const publicClient = createPublicClient({ transport: http(LIVE_RPC ?? 'http://127.0.0.1:8545') }) as PublicClient;

  it('confirms every event label of the sample at its log index', async () => {
    const labels = decodeShareMetadata(SAMPLE.blob, SAMPLE.handles);
    const checks = await verifyShareLabels({
      labels,
      handles: SAMPLE.handles,
      issuer: SAMPLE.issuer,
      publicClient,
      verify: 'events',
    });
    expect(checks).toEqual(['skipped', 'skipped', 'verified', 'verified', 'verified', 'verified', 'verified']);
  });

  it('rejects the fUSDy amount labelled at the deposit’s other log that carries it', async () => {
    const labels = decodeShareMetadata(SAMPLE.blob, SAMPLE.handles);
    const last = labels[6];
    if (last.kind !== 'event') throw new Error('expected an event label');
    const [check] = await verifyShareLabels({
      labels: [{ ...last, logIndex: 118 }],
      handles: [SAMPLE.handles[6]],
      issuer: SAMPLE.issuer,
      publicClient,
    });
    // log 118 carries the ctHash but is not a ConfidentialTransfer: the selector check fails it
    expect(check).toBe('mismatch');
  });

  it('checks the stored values while a node still has the state of their block', async () => {
    const labels = decodeShareMetadata(SAMPLE.blob, SAMPLE.handles);
    const checks = await verifyShareLabels({
      labels: labels.slice(0, 2),
      handles: SAMPLE.handles.slice(0, 2),
      issuer: SAMPLE.issuer,
      publicClient,
    });
    for (const check of checks) expect(['verified', 'unverifiable']).toContain(check);
  });
});
