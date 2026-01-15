import {
  type EncryptableAddress,
  type EncryptableBool,
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
import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype';
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
