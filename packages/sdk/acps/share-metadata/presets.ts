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
import type { EventValueLabel, ShareLabel, ShareLabelReadArg, StoredValueLabel } from './schema.js';

/**
 * Builders for labels. The format knows nothing about tokens: a balance is the value a view
 * function returned, a transfer amount the value of one event.
 */

/**
 * Stands for the issuer of the sharing ACP (whoever shares it, `acp.issuer`) among the arguments
 * of `viewFunctionLabel`. The label then says "the issuer" instead of carrying their address, and
 * the recipient fills it in from the share.
 */
export const ACP_ISSUER: unique symbol = Symbol.for('cofhe.share-metadata.issuer');

/** The call's arguments, each either its ABI value or `ACP_ISSUER`. */
type ReadArgs<args> = { readonly [K in keyof args]: args[K] | typeof ACP_ISSUER };

export type ViewFunctionLabelOptions<
  abi extends Abi,
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
> = {
  contract: Address;
  abi: abi;
  functionName: functionName;
  /** The arguments of the call; `ACP_ISSUER` stands for the share issuer. Static ABI types only. */
  args?: ReadArgs<ContractFunctionArgs<abi, 'pure' | 'view', functionName>>;
  /** Block the value was read at (on Arbitrum: the L2 block number). */
  block: bigint;
  /** Which 32-byte word of the return data is the ctHash; 0 (the default) for a single return value. */
  returnWord?: number;
};

const WORD_BYTES = 32;

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
  if (value === ACP_ISSUER) return { type: 'issuer' };
  const input = fn.inputs[index];
  const word = encodeAbiParameters([input], [value]);
  if (size(word) !== WORD_BYTES) {
    throw new Error(
      `share metadata: argument ${index} of ${fn.name} is ${input.type}; only arguments of one static 32-byte word can be labelled`
    );
  }
  return { type: 'word', value: word };
};

/**
 * The label of a value a view function returned at a block, built from the contract's ABI: the
 * function's selector, and each argument ABI-encoded to its word (or `ACP_ISSUER`). Throws when
 * the ABI has no such function, the arity is off, or an argument is not one static word.
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
