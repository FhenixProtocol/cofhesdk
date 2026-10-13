import { describe, expect, it } from 'vitest';
import { padHex, parseAbi, toEventSelector, toFunctionSelector, type Log } from 'viem';
import { encodeShareMetadata } from '../encode';
import { ERC7984_ABI } from '../erc7984';
import { eventLogLabel, viewFunctionLabel } from '../presets';
import {
  BALANCE_OF,
  CONFIDENTIAL_TRANSFER,
  CONFIDENTIAL_TRANSFER_TOPIC0,
  FUSD,
  FUSDY,
  ISSUER,
  SAMPLE,
  WORD,
} from './fixtures';

const ISSUER_WORD = padHex(ISSUER, { size: 32 }).toLowerCase();

describe('label presets', () => {
  it('labels a log with its position and event selector', () => {
    const log = {
      address: FUSD,
      blockNumber: 314217220n,
      transactionIndex: 5,
      logIndex: 30,
      topics: [CONFIDENTIAL_TRANSFER_TOPIC0],
    } as unknown as Log;
    expect(eventLogLabel(log)).toEqual(SAMPLE.labels[2]);
    expect(eventLogLabel(log).selector).toBe(CONFIDENTIAL_TRANSFER);
  });

  it('refuses a pending or anonymous log', () => {
    const base = {
      address: FUSD,
      blockNumber: 1n,
      transactionIndex: 0,
      logIndex: 0,
      topics: [CONFIDENTIAL_TRANSFER_TOPIC0],
    };
    expect(() => eventLogLabel({ ...base, blockNumber: null } as unknown as Log)).toThrow('pending');
    expect(() => eventLogLabel({ ...base, topics: [] } as unknown as Log)).toThrow('anonymous');
  });

  it('labels the ERC-7984 balance read from its ABI; the issuer argument compresses to the real share', () => {
    const [balanceOf, transfer] = ERC7984_ABI;
    expect(toFunctionSelector(balanceOf)).toBe(BALANCE_OF);
    expect(toEventSelector(transfer)).toBe(CONFIDENTIAL_TRANSFER_TOPIC0);

    const label = viewFunctionLabel({
      contract: FUSD,
      abi: ERC7984_ABI,
      functionName: 'confidentialBalanceOf',
      args: [ISSUER],
      block: 314285327n,
    });
    expect(label).toEqual({ ...SAMPLE.labels[0], args: [{ type: 'word', value: ISSUER_WORD }] });
    // encoded for a share by ISSUER, the address becomes "the issuer": the sample's own bytes
    expect(encodeShareMetadata([label], { issuer: ISSUER })).toBe(encodeShareMetadata([SAMPLE.labels[0]]));
    // for anyone else's share it stays a literal address
    expect(encodeShareMetadata([label], { issuer: FUSDY })).toBe(encodeShareMetadata([label]));
    expect(encodeShareMetadata([label])).not.toBe(encodeShareMetadata([SAMPLE.labels[0]]));
  });

  it('labels any view function from its ABI, encoding literal arguments to words', () => {
    const abi = parseAbi([
      'function balanceOfAt(address account, uint256 snapshot) view returns (uint256 total, bytes32 encrypted)',
      'function totalSupply() view returns (bytes32)',
    ]);
    expect(
      viewFunctionLabel({
        contract: FUSDY,
        abi,
        functionName: 'balanceOfAt',
        args: [ISSUER, 0xaan],
        returnWord: 1,
        block: 0x12ba88b2n,
      })
    ).toEqual({
      kind: 'stored',
      contract: FUSDY,
      selector: toFunctionSelector(abi[0]),
      args: [
        { type: 'word', value: ISSUER_WORD },
        { type: 'word', value: WORD },
      ],
      returnWord: 1,
      block: 0x12ba88b2n,
    });
    expect(viewFunctionLabel({ contract: FUSD, abi, functionName: 'totalSupply', block: 1n })).toEqual({
      kind: 'stored',
      contract: FUSD,
      selector: '0x18160ddd',
      args: [],
      returnWord: 0,
      block: 1n,
    });
  });

  it('refuses what the layout cannot carry or the ABI does not have', () => {
    const abi = parseAbi([
      'function nameOf(string key) view returns (bytes32)',
      'function balanceOf(address account) view returns (bytes32)',
      'function balanceOf(address account, uint256 id) view returns (bytes32)',
      'function mint(address to) returns (bytes32)',
    ]);
    const base = { contract: FUSD, abi, block: 1n } as const;
    expect(() => viewFunctionLabel({ ...base, functionName: 'nameOf', args: ['x'] })).toThrow('static 32-byte word');
    expect(() => viewFunctionLabel({ ...base, functionName: 'balanceOf', args: [] as never })).toThrow(
      'no single overload'
    );
    expect(() =>
      viewFunctionLabel({ ...base, abi: parseAbi(['function f(address a) view returns (bytes32)']), functionName: 'f' })
    ).toThrow('takes 1 arguments, 0 given');
    expect(() => viewFunctionLabel({ ...base, functionName: 'missing' as never })).toThrow('no function missing');
    expect(() => viewFunctionLabel({ ...base, functionName: 'mint' as never, args: [ISSUER] as never })).toThrow(
      'not a view function'
    );
  });
});
