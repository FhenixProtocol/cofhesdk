import { describe, expect, it } from 'vitest';
import type { Log } from 'viem';
import {
  CONFIDENTIAL_BALANCE_OF_SELECTOR,
  confidentialBalanceLabel,
  eventLabelOfLog,
  isConfidentialBalanceLabel,
} from '../presets';
import { BALANCE_OF, CONFIDENTIAL_TRANSFER, CONFIDENTIAL_TRANSFER_TOPIC0, FUSD, SAMPLE } from './fixtures';

describe('label presets', () => {
  it('labels a log with its position and event selector', () => {
    const log = {
      address: FUSD,
      blockNumber: 314217220n,
      transactionIndex: 5,
      logIndex: 30,
      topics: [CONFIDENTIAL_TRANSFER_TOPIC0],
    } as unknown as Log;
    expect(eventLabelOfLog(log)).toEqual(SAMPLE.labels[2]);
    expect(eventLabelOfLog(log).selector).toBe(CONFIDENTIAL_TRANSFER);
  });

  it('refuses a pending or anonymous log', () => {
    const base = {
      address: FUSD,
      blockNumber: 1n,
      transactionIndex: 0,
      logIndex: 0,
      topics: [CONFIDENTIAL_TRANSFER_TOPIC0],
    };
    expect(() => eventLabelOfLog({ ...base, blockNumber: null } as unknown as Log)).toThrow('pending');
    expect(() => eventLabelOfLog({ ...base, topics: [] } as unknown as Log)).toThrow('anonymous');
  });

  it('labels and recognises the issuer balance', () => {
    expect(CONFIDENTIAL_BALANCE_OF_SELECTOR).toBe(BALANCE_OF);
    const label = confidentialBalanceLabel(FUSD, 314285327n);
    expect(label).toEqual(SAMPLE.labels[0]);
    expect(isConfidentialBalanceLabel(label)).toBe(true);
    expect(isConfidentialBalanceLabel({ ...label, args: [] })).toBe(false);
    expect(isConfidentialBalanceLabel(SAMPLE.labels[2])).toBe(false);
  });
});
