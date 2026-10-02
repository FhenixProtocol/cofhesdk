import type { Address, Hex } from 'viem';
import type { ShareLabel } from '../schema';

/**
 * Shared test fixtures: two confidential tokens on Arbitrum Sepolia, labels with the exact blob
 * each encodes to, and one real share whose labels the chain confirms.
 */

export const FUSD: Address = '0x389be1Eb842290F264A6851f49c0149b8035a052';
export const FUSDY: Address = '0x06a52cf2e0cEAFc7d1f522400500ca7f3df18754';
export const ISSUER: Address = '0x1F547C0A6088856B9d58F843d9dd8C6e26f4969d';
/** confidentialBalanceOf(address) */
export const BALANCE_OF: Hex = '0x344ff101';
/** ConfidentialTransfer(address indexed from, address indexed to, bytes32 indexed amount), first 4 bytes of topic0 */
export const CONFIDENTIAL_TRANSFER: Hex = '0x67500e8d';
export const CONFIDENTIAL_TRANSFER_TOPIC0: Hex = '0x67500e8d0ed826d2194f514dd0d8124f35648ab6e3fb5e6ed867134cffe661e9';
export const WORD: Hex = '0x00000000000000000000000000000000000000000000000000000000000000aa';

const fusd = FUSD.slice(2).toLowerCase();
const fusdy = FUSDY.slice(2).toLowerCase();

/** Label lists with the blob each must encode to, written field by field. */
export const CASES: { name: string; labels: ShareLabel[]; blob: string }[] = [
  {
    name: 'a stored value read with the issuer as its one argument',
    labels: [
      {
        kind: 'stored',
        contract: FUSD,
        selector: BALANCE_OF,
        args: [{ type: 'issuer' }],
        returnWord: 0,
        block: 0x12ba88b2n,
      },
    ],
    blob: '0x03' + '01' + fusd + '01' + '344ff101' + '00' + ('00' + '00' + '00' + '12ba88b2' + '01'),
  },
  {
    name: 'a stored value read with no arguments',
    labels: [{ kind: 'stored', contract: FUSD, selector: '0x18160ddd', args: [], returnWord: 0, block: 1n }],
    blob: '0x03' + '01' + fusd + '01' + '18160ddd' + '00' + ('00' + '00' + '00' + '00000001' + '00'),
  },
  {
    name: 'a stored value with explicit arguments and a later return word',
    labels: [
      {
        kind: 'stored',
        contract: FUSDY,
        selector: '0x70a08231',
        args: [{ type: 'issuer' }, { type: 'word', value: WORD }],
        returnWord: 1,
        block: 0x12ba88b2n,
      },
    ],
    blob:
      '0x03' +
      '01' +
      fusdy +
      '01' +
      '70a08231' +
      '00' +
      ('00' + '00' + '00' + '12ba88b2' + 'ff' + '01' + '02' + '01' + '00' + WORD.slice(2)),
  },
  {
    name: 'an event value',
    labels: [
      { kind: 'event', contract: FUSD, block: 0x12ba9304n, txIndex: 7, logIndex: 300, selector: CONFIDENTIAL_TRANSFER },
    ],
    blob: '0x03' + '01' + fusd + '01' + '67500e8d' + '01' + '12ba9304' + '0007' + ('01' + '00' + '00' + '012c' + '00'),
  },
  {
    name: 'two event values of one transaction on two contracts',
    labels: [
      {
        kind: 'event',
        contract: FUSD,
        block: 0x12ba9375n,
        txIndex: 12,
        logIndex: 106,
        selector: CONFIDENTIAL_TRANSFER,
      },
      {
        kind: 'event',
        contract: FUSDY,
        block: 0x12ba9375n,
        txIndex: 12,
        logIndex: 115,
        selector: CONFIDENTIAL_TRANSFER,
      },
    ],
    blob:
      '0x03' +
      ('02' + fusd + fusdy) +
      ('01' + '67500e8d') +
      ('01' + '12ba9375' + '000c') +
      ('01' + '00' + '00' + '006a' + '00') +
      ('01' + '01' + '00' + '0073' + '00'),
  },
  {
    name: 'an unlabelled value',
    labels: [{ kind: 'unlabelled' }],
    blob: '0x03' + '00' + '00' + '00' + 'ff',
  },
];

/**
 * A real share on Arbitrum Sepolia: two balances read at one block, and five transfer amounts from
 * four transactions. The last two are the two values of one vault deposit (the fUSD that left and
 * the fUSDy that was minted), so they name the same transaction. The fUSDy amount is carried by two
 * logs of that transaction (115, the ConfidentialTransfer, and 118); the label names the first.
 */
export const SAMPLE = {
  issuer: ISSUER,
  blob: ('0x03' +
    ('02' + fusd + fusdy) +
    ('02' + '344ff101' + '67500e8d') +
    ('04' + '12ba93040005' + '12ba93070008' + '12ba9309000a' + '12ba9375000c') +
    '00000012bb9d0f01' +
    '00010012bb9d0f01' +
    '010000001e01' +
    '010001004101' +
    '010002008a01' +
    '010003006a01' +
    '010103007301') as Hex,
  handles: [
    '0xabaaf65246a7b1763ed4f04486115a27ffbd7abac4a0d10f139cfdac9a910500',
    '0x987a1e51721082556753153555c4f2242a8a592d80ff9551fb471f7427660500',
    '0xbb0c6b1feb27e5c2aec9667ce478006db331205407c754c7a47befa4b2c28500',
    '0x409fec2a564efb61ad75d544ca1933fe2d450e5d9ba847089b15375d1c0d8500',
    '0x39a2c1973989ae9e52dc4d0eed55ceb761d8b83dae6c1a8a66aa9d1defda8500',
    '0xf726d299727dd5c150ce1f31f42447495b3f4f42204d043ab9d21e78aced0500',
    '0x9b0420892380838a0d1fc858c0c2314f9248adb4cacaa766fe869645c1830500',
  ] as Hex[],
  labels: [
    {
      kind: 'stored',
      contract: FUSD,
      selector: BALANCE_OF,
      args: [{ type: 'issuer' }],
      returnWord: 0,
      block: 314285327n,
    },
    {
      kind: 'stored',
      contract: FUSDY,
      selector: BALANCE_OF,
      args: [{ type: 'issuer' }],
      returnWord: 0,
      block: 314285327n,
    },
    { kind: 'event', contract: FUSD, block: 314217220n, txIndex: 5, logIndex: 30, selector: CONFIDENTIAL_TRANSFER },
    { kind: 'event', contract: FUSD, block: 314217223n, txIndex: 8, logIndex: 65, selector: CONFIDENTIAL_TRANSFER },
    { kind: 'event', contract: FUSD, block: 314217225n, txIndex: 10, logIndex: 138, selector: CONFIDENTIAL_TRANSFER },
    { kind: 'event', contract: FUSD, block: 314217333n, txIndex: 12, logIndex: 106, selector: CONFIDENTIAL_TRANSFER },
    { kind: 'event', contract: FUSDY, block: 314217333n, txIndex: 12, logIndex: 115, selector: CONFIDENTIAL_TRANSFER },
  ] as ShareLabel[],
};

/** Live tests run only when this names an Arbitrum Sepolia RPC endpoint, e.g. https://sepolia-rollup.arbitrum.io/rpc */
export const LIVE_RPC = process.env.SHARE_METADATA_LIVE_RPC;
