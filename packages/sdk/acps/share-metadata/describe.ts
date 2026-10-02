import {
  decodeAbiParameters,
  padHex,
  toEventSelector,
  toEventSignature,
  toFunctionSelector,
  toFunctionSignature,
  type Abi,
  type AbiEvent,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hex,
} from 'viem';
import { decodeShareMetadata } from './decode.js';
import type { EventValueLabel, ShareLabel, StoredValueLabel } from './schema.js';

/** A parameter as the ABI names it. `name` is absent when the ABI leaves it unnamed. */
export type ShareLabelParam = { name?: string; type: string; indexed?: boolean };

/** One argument of a stored-value read, decoded with the function's input type when the ABI has one. */
export type ShareLabelArg = ShareLabelParam & {
  /** The argument stands for the share issuer. */
  isIssuer: boolean;
  /** The 32-byte ABI word, or undefined for an issuer argument when no issuer was given. */
  raw: Hex | undefined;
  /** The decoded value (an address, a bigint, ...), or the raw word when there is no ABI type for it. */
  value: unknown;
};

type DescriptionBase = {
  /** Position of the ctHash in `acp.handles`. */
  index: number;
  handle: Hex;
};

export type StoredValueDescription = DescriptionBase & {
  kind: 'stored';
  label: StoredValueLabel;
  contract: Address;
  block: bigint;
  selector: Hex;
  /** The view function, or null when the ABI of the contract is missing or has no function with this selector. */
  function: { name: string; signature: string; inputs: ShareLabelParam[] } | null;
  args: ShareLabelArg[];
  /** The returned field that holds the ctHash, when the ABI names the outputs. */
  output: ShareLabelParam | null;
};

export type EventValueDescription = DescriptionBase & {
  kind: 'event';
  label: EventValueLabel;
  contract: Address;
  block: bigint;
  txIndex: number;
  logIndex: number;
  selector: Hex;
  /**
   * The event, or null when the ABI of the contract is missing or has no event with this selector.
   * Parameter values are not in the label; they come with the log fetched to verify it.
   */
  event: { name: string; signature: string; inputs: ShareLabelParam[] } | null;
};

export type UnlabelledDescription = DescriptionBase & {
  kind: 'unlabelled';
  label: ShareLabel & { kind: 'unlabelled' };
};

export type ShareLabelDescription = StoredValueDescription | EventValueDescription | UnlabelledDescription;

/** ABIs by contract address; addresses compare case-insensitively. */
export type ShareLabelAbis = Readonly<Record<Address, Abi>>;

const abiOf = (abis: ShareLabelAbis, contract: Address): Abi | undefined => {
  const wanted = contract.toLowerCase();
  const key = (Object.keys(abis) as Address[]).find((address) => address.toLowerCase() === wanted);
  return key ? abis[key] : undefined;
};

const paramOf = ({ name, type, ...rest }: AbiParameter): ShareLabelParam => {
  const param: ShareLabelParam = { type };
  if (name) param.name = name;
  if ('indexed' in rest && typeof rest.indexed === 'boolean') param.indexed = rest.indexed;
  return param;
};

const findFunction = (abi: Abi | undefined, selector: Hex): AbiFunction | undefined =>
  abi?.find(
    (item): item is AbiFunction =>
      item.type === 'function' && toFunctionSelector(item).toLowerCase() === selector.toLowerCase()
  );

const findEvent = (abi: Abi | undefined, selector: Hex): AbiEvent | undefined =>
  abi?.find(
    (item): item is AbiEvent =>
      item.type === 'event' && toEventSelector(item).toLowerCase().startsWith(selector.toLowerCase())
  );

const decodeWord = (input: AbiParameter | undefined, raw: Hex): unknown => {
  if (input == null) return raw;
  try {
    return decodeAbiParameters([input], raw)[0];
  } catch {
    return raw;
  }
};

const describeStored = (
  base: DescriptionBase,
  label: StoredValueLabel,
  abis: ShareLabelAbis,
  issuer: Address | undefined
): StoredValueDescription => {
  const fn = findFunction(abiOf(abis, label.contract), label.selector);
  const args = label.args.map((arg, i): ShareLabelArg => {
    const input = fn?.inputs[i];
    const param = input ? paramOf(input) : { type: 'bytes32' };
    if (arg.type === 'issuer') {
      return {
        ...param,
        isIssuer: true,
        raw: issuer ? padHex(issuer, { size: 32 }) : undefined,
        value: issuer,
      };
    }
    return { ...param, isIssuer: false, raw: arg.value, value: decodeWord(input, arg.value) };
  });
  const output = fn?.outputs[label.returnWord];
  return {
    ...base,
    kind: 'stored',
    label,
    contract: label.contract,
    block: label.block,
    selector: label.selector,
    function: fn ? { name: fn.name, signature: toFunctionSignature(fn), inputs: fn.inputs.map(paramOf) } : null,
    args,
    output: output ? paramOf(output) : null,
  };
};

const describeEvent = (base: DescriptionBase, label: EventValueLabel, abis: ShareLabelAbis): EventValueDescription => {
  const event = findEvent(abiOf(abis, label.contract), label.selector);
  return {
    ...base,
    kind: 'event',
    label,
    contract: label.contract,
    block: label.block,
    txIndex: label.txIndex,
    logIndex: label.logIndex,
    selector: label.selector,
    event: event ? { name: event.name, signature: toEventSignature(event), inputs: event.inputs.map(paramOf) } : null,
  };
};

/**
 * Turns decoded labels into structured, human-readable items, one per ctHash in the order of
 * `handles`: the function name and decoded arguments of a stored value, the event name and
 * parameters of an event value. A contract without an ABI, or a selector its ABI doesn't have,
 * leaves the item in raw form (`function` / `event` null); this never throws. `issuer` (the share
 * issuer) fills in the arguments that stand for it.
 */
export const describeShareLabels = (
  labels: readonly ShareLabel[],
  handles: readonly Hex[],
  abis: ShareLabelAbis = {},
  options: { issuer?: Address } = {}
): ShareLabelDescription[] =>
  labels.map((label, index): ShareLabelDescription => {
    const base = { index, handle: handles[index] };
    switch (label.kind) {
      case 'stored':
        return describeStored(base, label, abis, options.issuer);
      case 'event':
        return describeEvent(base, label, abis);
      case 'unlabelled':
        return { ...base, kind: 'unlabelled', label };
    }
  });

/**
 * Decodes a metadata blob and describes it: `decodeShareMetadata` then `describeShareLabels`.
 * Throws only when the blob itself is malformed; missing ABIs leave items in raw form.
 */
export const describeShareMetadata = (
  blob: Hex,
  handles: readonly Hex[],
  abis: ShareLabelAbis = {},
  options: { issuer?: Address } = {}
): ShareLabelDescription[] => describeShareLabels(decodeShareMetadata(blob, handles), handles, abis, options);
