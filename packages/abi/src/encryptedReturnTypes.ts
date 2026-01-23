import { type Primitive, type LiteralToPrimitive, FheTypes } from '@cofhe/sdk';
import type { Abi, AbiFunction, ExtractAbiFunction, AbiParameter } from 'abitype';
import type {
  EncryptedReturnType,
  CofheAbiParametersToPrimitiveTypes,
  EBool,
  EAddress,
  EUint128,
  EUint16,
  EUint32,
  EUint64,
  EUint8,
} from './fhenixMap';
import {
  getAbiFunction,
  type IsUnion,
  type UnionToTuple,
  type ContractReturnType,
  extractArrayParameterType,
} from './utils';

export type CofheReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends string = string,
  args extends readonly unknown[] | undefined = readonly unknown[] | undefined,
  ///
  abiFunction extends AbiFunction = (
    abi extends Abi ? ExtractAbiFunction<abi, functionName> : AbiFunction
  ) extends infer abiFunction_ extends AbiFunction
    ? IsUnion<abiFunction_> extends true // narrow overloads by `args` by converting to tuple and filtering out overloads that don't match
      ? UnionToTuple<abiFunction_> extends infer abiFunctions extends readonly AbiFunction[]
        ? {
            [K in keyof abiFunctions]: (
              readonly unknown[] | undefined extends args // for functions that don't have inputs, `args` can be `undefined` so fallback to `readonly []`
                ? readonly []
                : args
            ) extends CofheAbiParametersToPrimitiveTypes<abiFunctions[K]['inputs'], 'inputs'>
              ? abiFunctions[K]
              : never;
          }[number] // convert back to union (removes `never` tuple entries: `['foo', never, 'bar'][number]` => `'foo' | 'bar'`)
        : never
      : abiFunction_
    : never,
  outputs extends readonly AbiParameter[] = abiFunction['outputs'],
  primitiveTypes extends readonly unknown[] = CofheAbiParametersToPrimitiveTypes<outputs, 'outputs'>,
> = [abiFunction] extends [never]
  ? unknown // `abiFunction` was not inferrable (e.g. `abi` declared as `Abi`)
  : readonly unknown[] extends primitiveTypes
    ? unknown // `abiFunction` was not inferrable (e.g. `abi` not const-asserted)
    : primitiveTypes extends readonly [] // unwrap `primitiveTypes`
      ? // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
        void // no outputs
      : primitiveTypes extends readonly [infer primitiveType]
        ? primitiveType // single output
        : primitiveTypes;

type EncryptedReturnTypeToReturnTypeMap<E extends EncryptedReturnType> = E extends EBool
  ? boolean
  : E extends EUint8
    ? bigint
    : E extends EUint16
      ? bigint
      : E extends EUint32
        ? bigint
        : E extends EUint64
          ? bigint
          : E extends EUint128
            ? bigint
            : E extends EAddress
              ? string
              : never;

type EncryptedReturnTypesToReturnTypes<T> = T extends Primitive
  ? LiteralToPrimitive<T>
  : T extends EncryptedReturnType
    ? EncryptedReturnTypeToReturnTypeMap<T>
    : {
        [K in keyof T]: EncryptedReturnTypesToReturnTypes<T[K]>;
      };

export type CofheReturnTypePostTransform<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends string = string,
  args extends readonly unknown[] | undefined = readonly unknown[] | undefined,
> = EncryptedReturnTypesToReturnTypes<CofheReturnType<abi, functionName, args>>;

const ENCRYPTED_RETURN_TYPE_INTERNAL_TYPES = [
  'ebool',
  'euint8',
  'euint16',
  'euint32',
  'euint64',
  'euint128',
  'eaddress',
] as const;
type EncryptedReturnTypeInternalType = (typeof ENCRYPTED_RETURN_TYPE_INTERNAL_TYPES)[number];

type EncryptedReturnTypeInternalTypeToReturnTypeMap<T extends EncryptedReturnTypeInternalType> = T extends 'ebool'
  ? EBool
  : T extends 'euint8'
    ? EUint8
    : T extends 'euint16'
      ? EUint16
      : T extends 'euint32'
        ? EUint32
        : T extends 'euint64'
          ? EUint64
          : T extends 'euint128'
            ? EUint128
            : T extends 'eaddress'
              ? EAddress
              : never;

function transformSingleEncryptedReturnTypeToReturnType<T extends EncryptedReturnTypeInternalType>(
  internalType: T,
  data: bigint
): EncryptedReturnTypeInternalTypeToReturnTypeMap<T> {
  switch (internalType) {
    case 'ebool':
      return {
        ctHash: data,
        utype: FheTypes.Bool,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    case 'euint8':
      return {
        ctHash: data,
        utype: FheTypes.Uint8,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    case 'euint16':
      return {
        ctHash: data,
        utype: FheTypes.Uint16,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    case 'euint32':
      return {
        ctHash: data,
        utype: FheTypes.Uint32,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    case 'euint64':
      return {
        ctHash: data,
        utype: FheTypes.Uint64,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    case 'euint128':
      return {
        ctHash: data,
        utype: FheTypes.Uint128,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    case 'eaddress':
      return {
        ctHash: data,
        utype: FheTypes.Uint160,
      } as EncryptedReturnTypeInternalTypeToReturnTypeMap<T>;
    default:
      throw new Error(`Unknown encrypted return type: ${internalType}`);
  }
}

function transformArrayOfEncryptedReturnTypesToReturnTypes<T extends EncryptedReturnTypeInternalType>(
  internalType: T,
  size: string | undefined,
  data: bigint[]
): EncryptedReturnTypeInternalTypeToReturnTypeMap<T>[] {
  // Ensure data is an array
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  // Ensure length of fixed length tuple matches the length of the data array
  if (size != null && size !== '' && parseInt(size) !== data.length) {
    throw new Error(`Array size mismatch: ${size} !== ${data.length}`);
  }

  // Transform each item in the data array into an return type
  return data.map((item) => transformSingleEncryptedReturnTypeToReturnType(internalType, item));
}

function internalTypeIsEncryptedReturnType(internalType: string): internalType is EncryptedReturnTypeInternalType {
  return ENCRYPTED_RETURN_TYPE_INTERNAL_TYPES.includes(internalType as any);
}

export function transformEncryptedReturnTypes<TAbi extends Abi, TFunctionName extends string>(
  abi: TAbi,
  functionName: TFunctionName,
  data: ContractReturnType<TAbi, TFunctionName>
): CofheReturnType<TAbi, TFunctionName> {
  const abiFunction = getAbiFunction(abi, functionName);
  const outputs = abiFunction?.outputs;
  if (abiFunction == null || outputs == null) {
    throw new Error(`Function ${functionName} not found in ABI`);
  }
  const outputsLength = outputs.length;

  function processParameter(param: AbiParameter, value: unknown): unknown {
    const [typeHead, typeSize] = extractArrayParameterType(param.type);
    const [internalTypeHead, internalTypeSize] = extractArrayParameterType(param.internalType);

    // Is encrypted return type
    if (internalTypeHead != null && internalTypeIsEncryptedReturnType(internalTypeHead)) {
      // Is single encrypted return type
      if (internalTypeSize == null) {
        return transformSingleEncryptedReturnTypeToReturnType(internalTypeHead, value as bigint);
      }

      // Is array of encrypted return types
      if (internalTypeSize != null) {
        console.log('array of encrypted return types', internalTypeHead, internalTypeSize, value);
        return transformArrayOfEncryptedReturnTypesToReturnTypes(internalTypeHead, internalTypeSize, value as bigint[]);
      }
    }

    // Tuple but not an encrypted return type (recursive case)
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

    // Not an encrypted return type, return original value
    return value;
  }

  // Process results (array case)
  if (outputsLength > 1) {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }
    if (outputsLength !== data.length) {
      throw new Error(`Mismatch in outputs length: ${outputsLength} !== ${data.length}`);
    }
    return data.map((item, index) => {
      return processParameter(outputs[index], item);
    }) as CofheReturnType<TAbi, TFunctionName>;
  }

  // Process retuls (single item case)
  return processParameter(outputs[0], data) as CofheReturnType<TAbi, TFunctionName>;
}
