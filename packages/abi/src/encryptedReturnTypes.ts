import type { Primitive, LiteralToPrimitive } from '@cofhe/sdk';
import type { Abi, AbiFunction, ExtractAbiFunction, AbiParameter } from 'abitype';
import type {
  EncryptedReturnType,
  CofheAbiParametersToPrimitiveTypes,
  EBool,
  EAddress,
  EUint128,
  EUint16,
  EUint256,
  EUint32,
  EUint64,
  EUint8,
} from './fhenixMap';
import type { IsUnion, UnionToTuple } from './utils';

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
            : E extends EUint256
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
