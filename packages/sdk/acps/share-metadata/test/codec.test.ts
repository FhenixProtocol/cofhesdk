import { describe, expect, it } from 'vitest';
import { size, type Hex } from 'viem';
import { encodeShareMetadata } from '../encode';
import { decodeShareMetadata } from '../decode';
import type { ShareLabel } from '../schema';
import { CASES, CONFIDENTIAL_TRANSFER, FUSD, SAMPLE, WORD } from './fixtures';

const handles = (count: number): Hex[] => Array.from({ length: count }, () => WORD);

describe('share metadata codec (v3)', () => {
  for (const { name, labels, blob } of CASES) {
    it(`encodes ${name}`, () => {
      expect(encodeShareMetadata(labels)).toBe(blob);
    });

    it(`decodes ${name}`, () => {
      expect(decodeShareMetadata(blob as Hex, handles(labels.length))).toEqual(labels);
    });
  }

  it('encodes the real sample into the 122-byte blob, function and event selectors in one list', () => {
    const blob = encodeShareMetadata(SAMPLE.labels);
    expect(blob).toBe(SAMPLE.blob);
    expect(size(blob)).toBe(122);
    expect(decodeShareMetadata(blob, SAMPLE.handles)).toEqual(SAMPLE.labels);
  });

  it('lists a transaction once however many labels name it', () => {
    const labels: ShareLabel[] = [
      { kind: 'event', contract: FUSD, block: 10n, txIndex: 1, logIndex: 2, selector: CONFIDENTIAL_TRANSFER },
      { kind: 'event', contract: FUSD, block: 10n, txIndex: 1, logIndex: 5, selector: CONFIDENTIAL_TRANSFER },
    ];
    // version, 1 contract, 1 selector, 1 transaction, two 6-byte entries
    expect(size(encodeShareMetadata(labels))).toBe(1 + 21 + 5 + 7 + 12);
  });

  describe('rejects', () => {
    it('another version', () => {
      expect(() => decodeShareMetadata('0x02000000ff', handles(1))).toThrow('unsupported version 2');
    });

    it('a blob that ends in the middle of a field', () => {
      expect(() => decodeShareMetadata(SAMPLE.blob.slice(0, -2) as Hex, SAMPLE.handles)).toThrow('ends in the middle');
    });

    it('more entries than ctHashes', () => {
      expect(() => decodeShareMetadata(SAMPLE.blob, SAMPLE.handles.slice(1))).toThrow('more entries');
    });

    it('fewer entries than ctHashes', () => {
      expect(() => decodeShareMetadata(SAMPLE.blob, [...SAMPLE.handles, WORD])).toThrow('ends in the middle');
    });

    it('a position outside its list', () => {
      // one contract, no selectors: the event entry points at selector 0
      const blob = ('0x03' +
        '01' +
        FUSD.slice(2) +
        '00' +
        '01' +
        '0000000a0001' +
        '01' +
        '00' +
        '00' +
        '0002' +
        '00') as Hex;
      expect(() => decodeShareMetadata(blob, handles(1))).toThrow('selector 0 is outside the selector list');
    });

    it('an unknown entry kind', () => {
      expect(() => decodeShareMetadata(('0x03000000' + '07') as Hex, handles(1))).toThrow('unknown entry kind 7');
    });

    it('a log index past uint16 when encoding', () => {
      const label: ShareLabel = {
        kind: 'event',
        contract: FUSD,
        block: 1n,
        txIndex: 0,
        logIndex: 70_000,
        selector: CONFIDENTIAL_TRANSFER,
      };
      expect(() => encodeShareMetadata([label])).toThrow();
    });

    it('a selector that is not 4 bytes when encoding', () => {
      const label: ShareLabel = {
        kind: 'stored',
        contract: FUSD,
        selector: '0x1234',
        args: [],
        returnWord: 0,
        block: 1n,
      };
      expect(() => encodeShareMetadata([label])).toThrow('a selector must be 4 bytes');
    });
  });
});
