import {
  encodeAbiParameters,
  size,
  sliceHex,
  toFunctionSelector,
  type Abi,
  type AbiFunction,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Log,
} from 'viem';
import { BYTE_WIDTH } from './layout';
import type { EventValueLabel, ShareLabel, ShareLabelReadArg, StoredValueLabel } from './schema';

/**
 * Builders for labels. The format knows nothing about tokens: a balance is the value a view
 * function returned, a transfer amount the value of one event.
 */

export type ViewFunctionLabelOptions<
  abi extends Abi,
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
> = {
  contract: Address;
  abi: abi;
  functionName: functionName;
  /**
   * The arguments of the call, static ABI types only. One equal to the share issuer's address
   * (your own, when you share your balance) is stored as "the issuer" when the labels are encoded.
   */
  args?: ContractFunctionArgs<abi, 'pure' | 'view', functionName>;
  /** Block the value was read at (on Arbitrum: the L2 block number). */
  block: bigint;
  /** Which 32-byte word of the return data is the ctHash; 0 (the default) for a single return value. */
  returnWord?: number;
};

const findViewFunction = (abi: Abi, name: string, arity: number): AbiFunction => {
  const named = abi.filter((item): item is AbiFunction => item.type === 'function' && item.name === name);
  if (named.length === 0) throw new Error(`share metadata: the ABI has no function ${name}`);
  const fitting = named.filter((fn) => fn.inputs.length === arity);
  if (fitting.length !== 1) {
    throw new Error(
      named.length === 1
        ? `share metadata: ${name} takes ${named[0].inputs.length} arguments, ${arity} given`
        : `share metadata: no single overload of ${name} takes ${arity} arguments`
    );
  }
  const [fn] = fitting;
  if (fn.stateMutability !== 'view' && fn.stateMutability !== 'pure') {
    throw new Error(`share metadata: ${name} is not a view function`);
  }
  return fn;
};

const encodeReadArg = (fn: AbiFunction, index: number, value: unknown): ShareLabelReadArg => {
  const input = fn.inputs[index];
  const word = encodeAbiParameters([input], [value]);
  if (size(word) !== BYTE_WIDTH.word) {
    throw new Error(
      `share metadata: argument ${index} of ${fn.name} is ${input.type}; only arguments of one static 32-byte word can be labelled`
    );
  }
  return { type: 'word', value: word };
};

/**
 * The label of a value a view function returned at a block, built from the contract's ABI: the
 * function's selector, and each argument ABI-encoded to its word. Throws when the ABI has no such
 * function, the arity is off, or an argument is not one static word.
 */
export const viewFunctionLabel = <
  const abi extends Abi,
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
>(
  options: ViewFunctionLabelOptions<abi, functionName>
): StoredValueLabel => {
  const { contract, block, returnWord = 0 } = options;
  const values = (options.args ?? []) as readonly unknown[];
  const fn = findViewFunction(options.abi, options.functionName, values.length);
  return {
    kind: 'stored',
    contract,
    selector: toFunctionSelector(fn),
    args: values.map((value, i) => encodeReadArg(fn, i, value)),
    returnWord,
    block,
  };
};

/**
 * The label of a value carried by a log, as viem returns it from `getLogs` / `getContractEvents`:
 * its contract, block, transaction and log index, and its event selector. Throws for a pending log.
 */
export const eventLogLabel = (
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

/** The label of a ctHash the issuer chooses not to describe. */
export const UNLABELLED: ShareLabel = { kind: 'unlabelled' };
