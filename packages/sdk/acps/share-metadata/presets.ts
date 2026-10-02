import { size, sliceHex, toFunctionSelector, type Address, type Log } from 'viem';
import type { EventValueLabel, ShareLabel, StoredValueLabel } from './schema.js';

/**
 * Builders for common labels. The format knows nothing about tokens: a balance is a stored value
 * read with one particular selector, and a transfer amount is a value of one event.
 */

/** `confidentialBalanceOf(address)` (ERC-7984). */
export const CONFIDENTIAL_BALANCE_OF_SELECTOR = toFunctionSelector('function confidentialBalanceOf(address)');

/**
 * The label of a value carried by a log, as viem returns it from `getLogs` / `getContractEvents`:
 * its contract, block, transaction and log index, and its event selector. Throws for a pending log.
 */
export const eventLabelOfLog = (
  log: Pick<Log, 'address' | 'blockNumber' | 'transactionIndex' | 'logIndex' | 'topics'>
): EventValueLabel => {
  const { address, blockNumber, transactionIndex, logIndex, topics } = log;
  const topic0 = topics[0];
  if (blockNumber == null || transactionIndex == null || logIndex == null) {
    throw new Error('share metadata: a pending log has no position to label');
  }
  if (topic0 == null || size(topic0) !== 32) throw new Error('share metadata: an anonymous log has no event selector');
  return {
    kind: 'event',
    contract: address,
    block: blockNumber,
    txIndex: transactionIndex,
    logIndex,
    selector: sliceHex(topic0, 0, 4),
  };
};

/** The issuer's confidential balance on a token at a block: the stored value `confidentialBalanceOf(issuer)`. */
export const confidentialBalanceLabel = (token: Address, block: bigint): StoredValueLabel => ({
  kind: 'stored',
  contract: token,
  selector: CONFIDENTIAL_BALANCE_OF_SELECTOR,
  args: [{ type: 'issuer' }],
  returnWord: 0,
  block,
});

/** Whether a label reads as the issuer's `confidentialBalanceOf` on its contract. */
export const isConfidentialBalanceLabel = (label: ShareLabel | null | undefined): label is StoredValueLabel =>
  label?.kind === 'stored' &&
  label.selector.toLowerCase() === CONFIDENTIAL_BALANCE_OF_SELECTOR &&
  label.returnWord === 0 &&
  label.args.length === 1 &&
  label.args[0].type === 'issuer';

/** The label of a ctHash the issuer chooses not to describe. */
export const UNLABELLED: ShareLabel = { kind: 'unlabelled' };
