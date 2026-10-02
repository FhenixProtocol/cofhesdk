import { describe, expect, it } from 'vitest';
import { padHex, parseAbi, toFunctionSelector } from 'viem';
import { describeShareMetadata } from '../describe';
import { encodeShareMetadata } from '../encode';
import { BALANCE_OF, CONFIDENTIAL_TRANSFER, FUSD, FUSDY, ISSUER, SAMPLE } from './fixtures';

const TOKEN_ABI = parseAbi([
  'function confidentialBalanceOf(address account) view returns (bytes32 balance)',
  'function allowanceAt(address owner, uint256 epoch) view returns (bytes32 previous, bytes32 current)',
  'event ConfidentialTransfer(address indexed from, address indexed to, bytes32 indexed amount)',
]);

describe('describeShareMetadata', () => {
  it('names the functions and events of the real sample from the ABIs', () => {
    const items = describeShareMetadata(
      SAMPLE.blob,
      SAMPLE.handles,
      { [FUSD]: TOKEN_ABI, [FUSDY]: TOKEN_ABI },
      { issuer: ISSUER }
    );
    expect(items).toHaveLength(7);

    const [balance] = items;
    expect(balance).toMatchObject({
      kind: 'stored',
      index: 0,
      handle: SAMPLE.handles[0],
      contract: FUSD,
      block: 314285327n,
      selector: BALANCE_OF,
      function: { name: 'confidentialBalanceOf', signature: 'confidentialBalanceOf(address)' },
      args: [{ name: 'account', type: 'address', isIssuer: true, value: ISSUER, raw: padHex(ISSUER, { size: 32 }) }],
      output: { name: 'balance', type: 'bytes32' },
    });

    const transfer = items[6];
    expect(transfer).toMatchObject({
      kind: 'event',
      index: 6,
      contract: FUSDY,
      block: 314217333n,
      txIndex: 12,
      logIndex: 115,
      selector: CONFIDENTIAL_TRANSFER,
      event: {
        name: 'ConfidentialTransfer',
        signature: 'ConfidentialTransfer(address,address,bytes32)',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'amount', type: 'bytes32', indexed: true },
        ],
      },
    });
  });

  it('matches ABI addresses case-insensitively', () => {
    const [item] = describeShareMetadata(SAMPLE.blob, SAMPLE.handles, {
      [FUSD.toLowerCase() as `0x${string}`]: TOKEN_ABI,
    });
    expect(item.kind === 'stored' && item.function?.name).toBe('confidentialBalanceOf');
  });

  it('decodes literal arguments with their ABI types, and names a later return word', () => {
    const blob = encodeShareMetadata([
      {
        kind: 'stored',
        contract: FUSD,
        selector: toFunctionSelector('allowanceAt(address,uint256)'),
        args: [{ type: 'issuer' }, { type: 'word', value: padHex('0x07', { size: 32 }) }],
        returnWord: 1,
        block: 1n,
      },
    ]);
    const [item] = describeShareMetadata(blob, [SAMPLE.handles[0]], { [FUSD]: TOKEN_ABI }, { issuer: ISSUER });
    expect(item).toMatchObject({
      kind: 'stored',
      function: { name: 'allowanceAt' },
      args: [
        { name: 'owner', type: 'address', isIssuer: true, value: ISSUER },
        { name: 'epoch', type: 'uint256', isIssuer: false, value: 7n },
      ],
      output: { name: 'current', type: 'bytes32' },
    });
  });

  it('leaves an item raw without an ABI, and never throws for it', () => {
    const items = describeShareMetadata(SAMPLE.blob, SAMPLE.handles);
    expect(items[0]).toMatchObject({ kind: 'stored', function: null, output: null, selector: BALANCE_OF });
    expect(items[0].kind === 'stored' && items[0].args[0]).toMatchObject({
      isIssuer: true,
      raw: undefined,
      value: undefined,
    });
    expect(items[2]).toMatchObject({ kind: 'event', event: null, selector: CONFIDENTIAL_TRANSFER, logIndex: 30 });
  });

  it('marks an unlabelled value', () => {
    const blob = encodeShareMetadata([{ kind: 'unlabelled' }]);
    expect(describeShareMetadata(blob, [SAMPLE.handles[0]])).toEqual([
      { kind: 'unlabelled', index: 0, handle: SAMPLE.handles[0], label: { kind: 'unlabelled' } },
    ]);
  });
});
