import {
  Encryptable,
  type AnyExternalHash,
  type EncryptableAddress,
  type EncryptableBool,
  type EncryptableItem,
  type EncryptableUint128,
  type EncryptableUint16,
  type EncryptableUint32,
  type EncryptableUint64,
  type EncryptableUint8,
  type ExternalAddressHash,
  type ExternalBoolHash,
  type ExternalUint128Hash,
  type ExternalUint16Hash,
  type ExternalUint32Hash,
  type ExternalUint64Hash,
  type ExternalUint8Hash,
  type LiteralToPrimitive,
  type Primitive,
} from '@cofhe/sdk';
import type { Abi, AbiFunction, AbiParameter, ExtractAbiFunction } from 'abitype';
import type { CofheAbiParametersToPrimitiveTypes } from './fhenixMap';
import {
  extractArrayParameterType,
  getAbiFunction,
  type MaybeExtractArrayParameterType,
  type MaybePartialBy,
  type ReadonlyWiden,
} from './utils';

export type CofheInputArgs<abi extends Abi | readonly unknown[] = Abi, functionName extends string = string> = GetArgs<
  abi,
  functionName
>['args'];

type ExternalHashToInputMap<E extends AnyExternalHash> = E extends ExternalBoolHash
  ? EncryptableBool['data']
  : E extends ExternalUint8Hash
    ? EncryptableUint8['data']
    : E extends ExternalUint16Hash
      ? EncryptableUint16['data']
      : E extends ExternalUint32Hash
        ? EncryptableUint32['data']
        : E extends ExternalUint64Hash
          ? EncryptableUint64['data']
          : E extends ExternalUint128Hash
            ? EncryptableUint128['data']
            : E extends ExternalAddressHash
              ? EncryptableAddress['data']
              : never;

// Note: AnyExternalHash is checked before Primitive - the branded hash types are structurally
// `0x${string}` (a subtype of `string`, which is itself a Primitive), so Primitive must not be
// checked first or every hash would be (incorrectly) widened via LiteralToPrimitive instead.
type EncryptedInputsToInputs<T> = T extends AnyExternalHash
  ? ExternalHashToInputMap<T>
  : T extends Primitive
    ? LiteralToPrimitive<T>
    : {
        [K in keyof T]: EncryptedInputsToInputs<T[K]>;
      };

/**
 * Drops the batch-signature argument from an args tuple.
 *
 * The signature slot is the first non-`external*` parameter that follows the contiguous run of
 * `external*` parameters - `FHE.asEuintXX(hash, proof)` is a pair, so the proof sits with the
 * hashes it authenticates rather than at the end of the parameter list. Walks the ABI parameters
 * and the args tuple in lockstep and elides the arg at that position.
 */
type DropSignatureSlotTuple<
  params extends readonly unknown[],
  args extends readonly unknown[],
  afterExternalRun extends boolean = false,
> = params extends readonly [infer P, ...infer PRest extends readonly unknown[]]
  ? args extends readonly [infer A, ...infer ARest extends readonly unknown[]]
    ? P extends AbiParameter
      ? ParamHasExternalInput<P> extends true
        ? readonly [A, ...DropSignatureSlotTuple<PRest, ARest, true>]
        : afterExternalRun extends true
          ? DropSignatureSlotTuple<PRest, ARest, false>
          : readonly [A, ...DropSignatureSlotTuple<PRest, ARest, false>]
      : readonly [A, ...DropSignatureSlotTuple<PRest, ARest, afterExternalRun>]
    : readonly []
  : args;

/** Non-tuple args (e.g. `undefined`) pass through unchanged, as the previous `DropLast` did. */
type DropSignatureSlot<params extends readonly unknown[], args> = args extends readonly unknown[]
  ? DropSignatureSlotTuple<params, args>
  : args;

const EXTERNAL_INPUT_INTERNAL_TYPES = [
  'externalEbool',
  'externalEuint8',
  'externalEuint16',
  'externalEuint32',
  'externalEuint64',
  'externalEuint128',
  'externalEaddress',
] as const;
type ExternalInputInternalType = (typeof EXTERNAL_INPUT_INTERNAL_TYPES)[number];

/** Type-level: does this ABI parameter carry (or, if a tuple, recursively contain) an `external*` input? */
type ParamHasExternalInput<param extends AbiParameter> =
  MaybeExtractArrayParameterType<param['internalType']> extends [infer head extends string, any]
    ? head extends ExternalInputInternalType
      ? true
      : false
    : param['internalType'] extends ExternalInputInternalType
      ? true
      : param extends { type: 'tuple'; components: infer components extends readonly AbiParameter[] }
        ? ParamsHaveExternalInput<components>
        : false;

type ParamsHaveExternalInput<params extends readonly AbiParameter[]> = params extends readonly [
  infer Head extends AbiParameter,
  ...infer Rest extends readonly AbiParameter[],
]
  ? ParamHasExternalInput<Head> extends true
    ? true
    : ParamsHaveExternalInput<Rest>
  : false;

/**
 * Pre-transform args for a function ABI: the raw plain values a caller supplies before encryption.
 *
 * If the function has one or more `external*` (encrypted) inputs, the plain `bytes` parameter
 * immediately following them is the shared batch signature slot - the caller never supplies it
 * directly (the SDK injects it after encryption), so it's dropped from this type entirely.
 */
export type CofheInputArgsPreTransform<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends string = string,
  abiFunction extends AbiFunction = abi extends Abi ? ExtractAbiFunction<abi, functionName> : AbiFunction,
> = EncryptedInputsToInputs<
  ParamsHaveExternalInput<abiFunction['inputs']> extends true
    ? DropSignatureSlot<abiFunction['inputs'], CofheInputArgs<abi, functionName>>
    : CofheInputArgs<abi, functionName>
>;

/// GetArgs from abitype (not exported from abitype)
type GetArgs<
  abi extends Abi | readonly unknown[] = Abi, // `readonly unknown[]` allows for non-const asserted types
  functionName extends string = string,
  args extends readonly unknown[] | undefined = readonly [],
  ///
  abiFunction extends AbiFunction = abi extends Abi ? ExtractAbiFunction<abi, functionName> : AbiFunction,
  primitiveTypes = CofheAbiParametersToPrimitiveTypes<abiFunction['inputs']>,
  args_ =
    | primitiveTypes // show all values
    | (abi extends Abi
        ? args extends primitiveTypes // infer value (if valid)
          ? primitiveTypes extends args // make sure `args` exactly matches `primitiveTypes` (e.g. avoid `args: readonly [{ foo: string; bar: number; }] | readonly [{ foo: string; }]`)
            ? // make inferred value of `args` match `primitiveTypes` (e.g. avoid union `args: readonly [123n] | readonly [bigint]`)
              ReadonlyWiden<args>
            : never
          : never
        : never)
    | (Abi extends abi ? readonly unknown[] : never), // fallback if `abi` is declared as `Abi`
> = MaybePartialBy<{ args: args_ }, readonly [] extends primitiveTypes ? 'args' : Abi extends abi ? 'args' : string>;

function internalTypeIsExternalInput(internalType: string): internalType is ExternalInputInternalType {
  return EXTERNAL_INPUT_INTERNAL_TYPES.includes(internalType as any);
}

function paramHasExternalInput(param: AbiParameter): boolean {
  const [internalTypeHead] = extractArrayParameterType(param.internalType);
  if (internalTypeHead != null && internalTypeIsExternalInput(internalTypeHead)) return true;
  if ('components' in param && Array.isArray(param.components)) {
    return param.components.some((component) => paramHasExternalInput(component));
  }
  return false;
}

function transformSingleExternalToEncryptable(internalType: ExternalInputInternalType, data: unknown): EncryptableItem {
  switch (internalType) {
    case 'externalEbool':
      return Encryptable.bool(data as boolean);
    case 'externalEuint8':
      return Encryptable.uint8(data as string | bigint);
    case 'externalEuint16':
      return Encryptable.uint16(data as string | bigint);
    case 'externalEuint32':
      return Encryptable.uint32(data as string | bigint);
    case 'externalEuint64':
      return Encryptable.uint64(data as string | bigint);
    case 'externalEuint128':
      return Encryptable.uint128(data as string | bigint);
    case 'externalEaddress':
      return Encryptable.address(data as string | bigint);
    default:
      throw new Error(`Unknown external input type: ${internalType}`);
  }
}

function transformArrayOfExternalsToEncryptables(
  internalType: ExternalInputInternalType,
  size: string | undefined,
  data: unknown
): EncryptableItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  if (size != null && size !== '' && parseInt(size) !== data.length) {
    throw new Error(`Array size mismatch: ${size} !== ${data.length}`);
  }

  return data.map((item) => transformSingleExternalToEncryptable(internalType, item));
}

/**
 * Extracts encryptable values from function arguments based on the ABI.
 * Transforms raw data values into EncryptableItem objects that can be passed to the encrypt function.
 *
 * @param abi - The ABI containing the function definition
 * @param functionName - Name of the function
 * @param args - Function arguments in the format of CofheInputArgsPreTransform (raw data values;
 *   if the function has `external*` inputs, the trailing batch-signature slot is NOT included)
 * @returns Array of EncryptableItem objects ready for encryption, in ABI parameter order
 */
export function extractEncryptableValues<TAbi extends Abi, TFunctionName extends string>(
  abi: TAbi,
  functionName: TFunctionName,
  args: CofheInputArgsPreTransform<TAbi, TFunctionName>
): EncryptableItem[] {
  const abiFunction = getAbiFunction(abi, functionName);
  const inputs = abiFunction?.inputs;
  if (abiFunction == null || inputs == null) {
    throw new Error(`Function ${functionName} not found in ABI`);
  }

  if (!Array.isArray(args)) {
    throw new Error('Arguments must be an array');
  }

  const hasExternalInputs = inputs.some((input) => paramHasExternalInput(input));
  const signatureSlotIndex = findSignatureSlotIndex(inputs, hasExternalInputs, functionName);

  // Collect encrypted values as EncryptableItem objects in order (flat array)
  const encryptableItems: EncryptableItem[] = [];

  function processParameter(param: AbiParameter, value: unknown): void {
    const [typeHead, typeSize] = extractArrayParameterType(param.type);
    const [internalTypeHead, internalTypeSize] = extractArrayParameterType(param.internalType);

    // Bare external input (e.g. `externalEuint32`, type: 'bytes32')
    if (typeSize == null && internalTypeHead != null && internalTypeIsExternalInput(internalTypeHead)) {
      encryptableItems.push(transformSingleExternalToEncryptable(internalTypeHead, value));
      return;
    }

    // Array of external inputs (e.g. `externalEuint32[]`/`externalEuint32[2]`, type: 'bytes32[]'/'bytes32[2]')
    if (typeSize != null && internalTypeHead != null && internalTypeIsExternalInput(internalTypeHead)) {
      const encryptables = transformArrayOfExternalsToEncryptables(internalTypeHead, typeSize, value);
      encryptableItems.push(...encryptables);
      return;
    }

    // Tuple recursive case (struct that may itself contain external inputs)
    if (typeHead === 'tuple') {
      if ('components' in param && Array.isArray(param.components)) {
        param.components.forEach((component) => {
          processParameter(component, (value as Record<string, unknown>)[component.name]);
        });
      }
      return;
    }

    // Not an external input, and cannot contain one
    return;
  }

  // Process all inputs, skipping the batch-signature slot (nothing to extract there). `args` is the
  // pre-transform tuple, which omits that slot, so its indices lag by one past the signature.
  let argIndex = 0;
  inputs.forEach((input, index) => {
    if (index === signatureSlotIndex) return;
    const arg = args[argIndex];
    if (arg == null) {
      throw new Error(`Argument ${argIndex} is undefined`);
    }
    argIndex++;
    processParameter(input, arg);
  });

  return encryptableItems;
}

/**
 * Index of the shared batch-signature parameter: the plain `bytes` immediately after the
 * contiguous run of `external*` parameters. Returns -1 when the function has no encrypted inputs.
 *
 * The proof pairs with the hashes it authenticates (`FHE.asEuintXX(hash, proof)`), so it does not
 * have to be the last parameter - anything may follow it.
 */
function findSignatureSlotIndex(
  inputs: readonly AbiParameter[],
  hasExternalInputs: boolean,
  functionName: string
): number {
  if (!hasExternalInputs) return -1;

  const externalIndices = inputs.reduce<number[]>((acc, input, index) => {
    if (paramHasExternalInput(input)) acc.push(index);
    return acc;
  }, []);

  const first = externalIndices[0]!;
  const last = externalIndices[externalIndices.length - 1]!;
  if (last - first + 1 !== externalIndices.length) {
    throw new Error(
      `Function ${functionName} has encrypted (external*) inputs at non-adjacent positions ` +
        `(${externalIndices.join(', ')}). They share one batch signature, so they must be contiguous ` +
        `with the 'bytes' signature parameter immediately after them`
    );
  }

  const slotIndex = last + 1;
  const slot = inputs[slotIndex];
  if (slot?.type !== 'bytes') {
    throw new Error(
      `Function ${functionName} has encrypted (external*) inputs, so the parameter immediately after ` +
        `them must be a plain 'bytes' parameter to receive the shared batch signature - found ` +
        `'${slot?.type ?? 'nothing'}' at position ${slotIndex} instead`
    );
  }

  return slotIndex;
}

/**
 * Re-inserts encrypted values back into function arguments based on the ABI.
 * Takes the batch-verified result (per-input hashes, in order, followed by the single shared
 * signature) and the original args structure, and produces the final call args: each `external*`
 * position gets its corresponding hash, and the trailing `bytes` parameter gets the signature.
 *
 * This function mirrors the extraction logic in extractEncryptableValues, ensuring values
 * are inserted in the exact same order and locations where they were extracted.
 *
 * @param abi - The ABI containing the function definition
 * @param functionName - Name of the function
 * @param args - Original function arguments in the format of CofheInputArgsPreTransform
 * @param encryptedResult - `[...hashes, signature]`, as returned by `EncryptInputsBuilder.execute()`
 * @returns Function arguments with encrypted values inserted (format of CofheInputArgs)
 */
export function insertEncryptedValues<TAbi extends Abi, TFunctionName extends string>(
  abi: TAbi,
  functionName: TFunctionName,
  args: CofheInputArgsPreTransform<TAbi, TFunctionName>,
  encryptedResult: readonly `0x${string}`[]
): CofheInputArgs<TAbi, TFunctionName> {
  const abiFunction = getAbiFunction(abi, functionName);
  const inputs = abiFunction?.inputs;
  if (abiFunction == null || inputs == null) {
    throw new Error(`Function ${functionName} not found in ABI`);
  }

  if (!Array.isArray(args)) {
    throw new Error('Arguments must be an array');
  }

  const hasExternalInputs = inputs.some((input) => paramHasExternalInput(input));
  const signatureSlotIndex = findSignatureSlotIndex(inputs, hasExternalInputs, functionName);

  const hashes = hasExternalInputs ? encryptedResult.slice(0, -1) : [];
  const signature = hasExternalInputs ? encryptedResult[encryptedResult.length - 1] : undefined;

  // Track position in the hashes array
  let hashIndex = 0;

  function processParameter(param: AbiParameter, value: unknown): unknown {
    const [typeHead, typeSize] = extractArrayParameterType(param.type);
    const [internalTypeHead] = extractArrayParameterType(param.internalType);

    // Bare external input - substitute its hash
    if (typeSize == null && internalTypeHead != null && internalTypeIsExternalInput(internalTypeHead)) {
      if (hashIndex >= hashes.length) {
        throw new Error(`Not enough encrypted hashes: expected at least ${hashIndex + 1}, got ${hashes.length}`);
      }
      const hash = hashes[hashIndex];
      hashIndex++;
      return hash;
    }

    // Array of external inputs - substitute the corresponding slice of hashes
    if (typeSize != null && internalTypeHead != null && internalTypeIsExternalInput(internalTypeHead)) {
      const arrayLength = Array.isArray(value) ? value.length : 0;
      if (arrayLength === 0) {
        return [];
      }

      if (hashIndex + arrayLength > hashes.length) {
        throw new Error(
          `Not enough encrypted hashes: expected at least ${hashIndex + arrayLength}, got ${hashes.length}`
        );
      }

      const hashArray = hashes.slice(hashIndex, hashIndex + arrayLength);
      hashIndex += arrayLength;
      return hashArray;
    }

    // Tuple recursive case (struct that may itself contain external inputs)
    if (typeHead === 'tuple') {
      if ('components' in param && Array.isArray(param.components)) {
        const valueObj = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};

        param.components.forEach((component) => {
          const componentName = component.name;
          if (componentName) {
            const componentValue = valueObj[componentName];
            if (componentValue !== undefined) {
              result[componentName] = processParameter(component, componentValue);
            }
          }
        });

        return result;
      }
      return value;
    }

    // Not an external input, return original value
    return value;
  }

  // Rebuild the full arg list; the signature slot is injected directly. `args` omits that slot, so
  // its indices lag by one past the signature position.
  let argIndex = 0;
  const result = inputs.map((input, index) => {
    if (index === signatureSlotIndex) {
      return signature;
    }
    const arg = args[argIndex];
    if (arg == null) {
      throw new Error(`Argument ${argIndex} is undefined`);
    }
    argIndex++;
    return processParameter(input, arg);
  });

  // Verify we used all encrypted hashes
  if (hashIndex !== hashes.length) {
    throw new Error(`Mismatch in encrypted hashes count: used ${hashIndex}, but provided ${hashes.length}`);
  }

  return result as CofheInputArgs<TAbi, TFunctionName>;
}
