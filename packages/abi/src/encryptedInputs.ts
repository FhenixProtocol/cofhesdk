import {
  Encryptable,
  type EncryptableAddress,
  type EncryptableBool,
  type EncryptableItem,
  type EncryptableUint128,
  type EncryptableUint16,
  type EncryptableUint32,
  type EncryptableUint64,
  type EncryptableUint8,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedItemInput,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
  type LiteralToPrimitive,
  type Primitive,
} from '@cofhe/sdk';
import type {
  Abi,
  AbiConstructor,
  AbiError,
  AbiEvent,
  AbiFallback,
  AbiFunction,
  AbiParameter,
  AbiReceive,
  ExtractAbiFunction,
} from 'abitype';
import type { CofheAbiParametersToPrimitiveTypes } from './fhenixMap';
import type { MaybePartialBy, ReadonlyWiden } from './utils';

export type CofheInputArgs<abi extends Abi | readonly unknown[] = Abi, functionName extends string = string> = GetArgs<
  abi,
  functionName
>['args'];

type EncryptedInputToInputMap<E extends EncryptedItemInput> = E extends EncryptedBoolInput
  ? EncryptableBool['data']
  : E extends EncryptedUint8Input
    ? EncryptableUint8['data']
    : E extends EncryptedUint16Input
      ? EncryptableUint16['data']
      : E extends EncryptedUint32Input
        ? EncryptableUint32['data']
        : E extends EncryptedUint64Input
          ? EncryptableUint64['data']
          : E extends EncryptedUint128Input
            ? EncryptableUint128['data']
            : E extends EncryptedAddressInput
              ? EncryptableAddress['data']
              : never;

type EncryptedInputsToInputs<T> = T extends Primitive
  ? LiteralToPrimitive<T>
  : T extends EncryptedItemInput
    ? EncryptedInputToInputMap<T>
    : {
        [K in keyof T]: EncryptedInputsToInputs<T[K]>;
      };

export type CofheInputArgsPreTransform<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends string = string,
> = EncryptedInputsToInputs<CofheInputArgs<abi, functionName>>;

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

// Runtime helper to check if an internalType is an encrypted input type
const ENCRYPTED_INPUT_INTERNAL_TYPES = [
  'struct InEbool',
  'struct InEuint8',
  'struct InEuint16',
  'struct InEuint32',
  'struct InEuint64',
  'struct InEuint128',
  'struct InEaddress',
] as const;
type EncryptedInputInternalType = (typeof ENCRYPTED_INPUT_INTERNAL_TYPES)[number];

function transformSingleEncryptedInputToEncryptable(
  internalType: EncryptedInputInternalType,
  data: unknown
): EncryptableItem {
  switch (internalType) {
    case 'struct InEbool':
      return Encryptable.bool(data as boolean);
    case 'struct InEuint8':
      return Encryptable.uint8(data as string | bigint);
    case 'struct InEuint16':
      return Encryptable.uint16(data as string | bigint);
    case 'struct InEuint32':
      return Encryptable.uint32(data as string | bigint);
    case 'struct InEuint64':
      return Encryptable.uint64(data as string | bigint);
    case 'struct InEuint128':
      return Encryptable.uint128(data as string | bigint);
    case 'struct InEaddress':
      return Encryptable.address(data as string | bigint);
    default:
      throw new Error(`Unknown encrypted input type: ${internalType}`);
  }
}

function transformArrayOfEncryptedInputsToEncryptables(
  internalType: EncryptedInputInternalType,
  size: string | undefined,
  data: unknown
): EncryptableItem[] {
  // Ensure data is an array
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  // Ensure length of fixed length tuple matches the length of the data array
  if (size != null && size !== '' && parseInt(size) !== data.length) {
    throw new Error(`Array size mismatch: ${size} !== ${data.length}`);
  }

  // Transform each item in the data array into an encryptable item
  return data.map((item) => transformSingleEncryptedInputToEncryptable(internalType, item));
}

/**
 * Extracts array parameter type information from a type string.
 * Always returns a tuple, with undefined for non-array types.
 *
 * @param type - Type string like "tuple", "tuple[]", or "tuple[2]"
 * @returns [head, size] where:
 *   - head is the base type
 *   - size is undefined for non-arrays, "" for dynamic arrays, or the number as a string for fixed arrays
 *
 * @example
 * extractArrayParameterType("tuple") // ["tuple", undefined]
 * extractArrayParameterType("tuple[]") // ["tuple", ""]
 * extractArrayParameterType("tuple[2]") // ["tuple", "2"]
 */
function extractArrayParameterType<T extends string | undefined>(type: T): [T, string | undefined] {
  if (type == null) return [type, undefined];

  const match = type.match(/^(.+)\[(\d*)\]$/);

  if (!match) {
    // Not an array type, return [type, undefined]
    return [type, undefined];
  }

  const head = match[1];
  const size = match[2]; // Empty string for dynamic arrays, or digits for fixed arrays

  // Return empty string for dynamic arrays, or the size string for fixed arrays
  return [head as T, size === '' ? '' : size];
}

// Pathways
// - type is a tuple && internalType is exactly an encrypted input type (struct InEbool)
// - - extract the base encrypted type (InEbool) and convert into an encryptable item
// - type is a tuple && internalType is a tuple of encrypted input types (struct InEuint32[2] / struct InEuint32[])
// - - extract the base encrypted type and length, and convert into an array of encryptable items
// - type is a tuple && internalType is not an encrypted input type
// - - iterate components
// - type is not a tuple
// - - throw away

function internalTypeIsEncryptedInput(internalType: string): internalType is EncryptedInputInternalType {
  return ENCRYPTED_INPUT_INTERNAL_TYPES.includes(internalType as any);
}

type AbiItem = AbiConstructor | AbiError | AbiEvent | AbiFallback | AbiFunction | AbiReceive;

function isAbiFunction(item: AbiItem): item is AbiFunction {
  return item.type === 'function' && 'name' in item && 'outputs' in item;
}

function getAbiFunction<TAbi extends Abi, TFunctionName extends string>(
  abi: TAbi,
  functionName: TFunctionName
): AbiFunction | undefined {
  return abi.find((item) => {
    const isFunction = isAbiFunction(item);
    if (!isFunction) return false;
    return item.name === functionName;
  }) as AbiFunction | undefined;
}

/**
 * Extracts encryptable values from function arguments based on the ABI.
 * Transforms raw data values into EncryptableItem objects that can be passed to the encrypt function.
 *
 * @param abi - The ABI containing the function definition
 * @param functionName - Name of the function
 * @param args - Function arguments in the format of CofheInputArgsPreTransform (raw data values)
 * @returns Array of EncryptableItem objects ready for encryption
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

  // Collect encrypted values as EncryptableItem objects in order (flat array)
  const encryptableItems: EncryptableItem[] = [];

  // Process each parameter - transforms raw values into EncryptableItem objects
  function processParameter(param: AbiParameter, value: unknown): void {
    const [typeHead, typeSize] = extractArrayParameterType(param.type);
    const [internalTypeHead, internalTypeSize] = extractArrayParameterType(param.internalType);

    /** 
      {
        name: 'inNumber',
        type: 'tuple',
        internalType: 'struct InEuint32',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      }
    */
    if (
      typeHead === 'tuple' &&
      typeSize == null &&
      internalTypeHead != null &&
      internalTypeIsEncryptedInput(internalTypeHead)
    ) {
      const encryptable = transformSingleEncryptedInputToEncryptable(internalTypeHead, value);
      encryptableItems.push(encryptable);
      return;
    }

    /**
      {
        name: 'inEuint32Array',
        type: 'tuple[2]',
        internalType: 'struct InEuint32[2]',
        components: [
          {
            name: 'ctHash',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'securityZone',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'utype',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'signature',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      }
     */
    if (
      typeHead === 'tuple' &&
      typeSize != null &&
      internalTypeHead != null &&
      internalTypeIsEncryptedInput(internalTypeHead)
    ) {
      const encryptables = transformArrayOfEncryptedInputsToEncryptables(internalTypeHead, typeSize, value);
      encryptableItems.push(...encryptables);
      return;
    }

    /**
     {
        name: 'containsEncryptedInput',
        type: 'tuple',
        internalType: 'struct ABITest.ContainsEncryptedInput',
        components: [
          {
            name: 'value',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'encryptedInput',
            type: 'tuple',
            internalType: 'struct InEuint32',
            components: [
              {
                name: 'ctHash',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'securityZone',
                type: 'uint8',
                internalType: 'uint8',
              },
              {
                name: 'utype',
                type: 'uint8',
                internalType: 'uint8',
              },
              {
                name: 'signature',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      }
     */
    if (typeHead === 'tuple' && (internalTypeHead == null || !internalTypeIsEncryptedInput(internalTypeHead))) {
      if ('components' in param && Array.isArray(param.components)) {
        param.components.forEach((component) => {
          processParameter(component, (value as Record<string, unknown>)[component.name]);
        });
      }
      return;
    }

    // param.type is not a tuple, so cannot be an encrypted input or contain encrypted inputs
    return;
  }

  // Process all inputs
  inputs.forEach((input, index) => {
    const arg = args[index];
    if (arg == null) {
      throw new Error(`Argument ${index} is undefined`);
    }
    processParameter(input, arg);
  });

  return encryptableItems;
}
