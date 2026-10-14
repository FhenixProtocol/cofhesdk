import { describe, expect, it } from 'vitest';
import { createPublicClient, http, type PublicClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { TEST_PRIVATE_KEY } from '@cofhe/test-setup';
import { decodeShareMetadata } from '../decode';
import { verifyShareLabels } from '../verify';
import { SAMPLE } from './fixtures';

/**
 * The real sample against Arbitrum Sepolia, read from the public RPC. A live-chain suite like
 * `core/test/decrypt.test.ts`: it runs where TEST_PRIVATE_KEY is set (the key itself is not used),
 * so `pnpm test` stays offline and `pnpm test:live` covers it.
 */
describe.skipIf(!TEST_PRIVATE_KEY)('share metadata against Arbitrum Sepolia', () => {
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(arbitrumSepolia.rpcUrls.default.http[0]),
  }) as PublicClient;

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
