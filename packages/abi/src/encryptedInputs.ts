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
  type EncryptedUint256Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
  type LiteralToPrimitive,
  type Primitive,
} from '@cofhe/sdk';
import type {
  Abi,
  AbiFunction,
  AbiParameter,
  AbiParameterKind,
  AbiStateMutability,
  AbiType,
  AbiTypeToPrimitiveType,
  Address,
  ExtractAbiFunction,
  ExtractAbiFunctionNames,
  ResolvedRegister,
  SolidityArray,
  SolidityFixedArrayRange,
  SolidityFixedArraySizeLookup,
  SolidityTuple,
} from 'abitype';
import type { Tuple, Merge } from 'node_modules/abitype/dist/types/types';

export type EBool = bigint & {
  __ebool: void;
};
export type EUint8 = bigint & {
  __euint8: void;
};
export type EUint16 = bigint & {
  __euint16: void;
};
export type EUint32 = bigint & {
  __euint32: void;
};
export type EUint64 = bigint & {
  __euint64: void;
};
export type EUint128 = bigint & {
  __euint128: void;
};
export type EUint256 = bigint & {
  __euint256: void;
};
export type EAddress = bigint & {
  __eaddress: void;
};

type FhenixMap = {
  // Input Structs
  'struct InEbool': EncryptedBoolInput;
  'struct InEuint8': EncryptedUint8Input;
  'struct InEuint16': EncryptedUint16Input;
  'struct InEuint32': EncryptedUint32Input;
  'struct InEuint64': EncryptedUint64Input;
  'struct InEuint128': EncryptedUint128Input;
  'struct InEuint256': EncryptedUint256Input;
  'struct InEaddress': EncryptedAddressInput;

  // Input Structs
  // 'struct InEbool[]': EncryptedBoolInput[];
  // 'struct InEuint8[]': EncryptedUint8Input[];
  // 'struct InEuint16[]': EncryptedUint16Input[];
  // 'struct InEuint32[]': EncryptedUint32Input[];
  // 'struct InEuint64[]': EncryptedUint64Input[];
  // 'struct InEuint128[]': EncryptedUint128Input[];
  // 'struct InEuint256[]': EncryptedUint256Input[];
  // 'struct InEaddress[]': EncryptedAddressInput[];

  // Exposed encrypted primitives
  ebool: EBool;
  euint8: EUint8;
  euint16: EUint16;
  euint32: EUint32;
  euint64: EUint64;
  euint128: EUint128;
  euint256: EUint256;
  eaddress: EAddress;
};
export type FhenixMapUnion = keyof FhenixMap;

// BASE

export type Error<messages extends string | string[]> = messages extends string
  ? [
      // Surrounding with array to prevent `messages` from being widened to `string`
      `Error: ${messages}`,
    ]
  : {
      [key in keyof messages]: messages[key] extends infer message extends string ? `Error: ${message}` : never;
    };

export type AbiParameterToPrimitiveType<
  abiParameter extends AbiParameter | { name: string; type: unknown; internalType?: unknown },
  abiParameterKind extends AbiParameterKind = AbiParameterKind,
  // 1. Check to see if type is basic (not tuple or array) and can be looked up immediately.
> = abiParameter['internalType'] extends FhenixMapUnion
  ? FhenixMap[abiParameter['internalType']]
  : abiParameter['type'] extends AbiBasicType
    ? AbiTypeToPrimitiveType<abiParameter['type'], abiParameterKind>
    : // 2. Check if type is tuple and covert each component
      abiParameter extends {
          type: SolidityTuple;
          components: infer components extends readonly AbiParameter[];
        }
      ? AbiComponentsToPrimitiveType<components, abiParameterKind>
      : // 3. Check if type is array.
        MaybeExtractArrayParameterType<abiParameter['type']> extends [infer head extends string, infer size]
        ? AbiArrayToPrimitiveType<abiParameter, abiParameterKind, head, size>
        : // 4. If type is not basic, tuple, or array, we don't know what the type is.
          // This can happen when a fixed-length array is out of range (`Size` doesn't exist in `SolidityFixedArraySizeLookup`),
          // the array has depth greater than `ResolvedRegister['arrayMaxDepth']`, etc.
          ResolvedRegister['strictAbiType'] extends true
          ? Error<`Unknown type '${abiParameter['type'] & string}'.`>
          : // 5. If we've gotten this far, let's check for errors in tuple components.
            // (Happens for recursive tuple typed data types.)
            abiParameter extends { components: Error<string> }
            ? abiParameter['components']
            : unknown;

// export type AbiParameterToPrimitiveType<
//   abiParameter extends AbiParameter | { name: string; type: unknown; internalType?: unknown },
//   abiParameterKind extends AbiParameterKind = AbiParameterKind,
// > = AbiParameterToPrimitiveType<abiParameter, abiParameterKind>;

export type FhenixAbiParametersToPrimitiveTypes<
  abiParameters extends readonly AbiParameter[],
  abiParameterKind extends AbiParameterKind = AbiParameterKind,
> = {
  [key in keyof abiParameters]: AbiParameterToPrimitiveType<abiParameters[key], abiParameterKind>;
};

export type EncryptedInputToEncryptableMap<E extends EncryptedItemInput> = E extends EncryptedBoolInput
  ? EncryptableBool
  : E extends EncryptedUint8Input
    ? EncryptableUint8
    : E extends EncryptedUint16Input
      ? EncryptableUint16
      : E extends EncryptedUint32Input
        ? EncryptableUint32
        : E extends EncryptedUint64Input
          ? EncryptableUint64
          : E extends EncryptedUint128Input
            ? EncryptableUint128
            : E extends EncryptedAddressInput
              ? EncryptableAddress
              : never;

export type EncryptedInputsToEncryptables<T> = T extends Primitive
  ? LiteralToPrimitive<T>
  : T extends EncryptedItemInput
    ? EncryptedInputToEncryptableMap<T>
    : {
        [K in keyof T]: EncryptedInputsToEncryptables<T[K]>;
      };

export type EncryptedInputToInputMap<E extends EncryptedItemInput> = E extends EncryptedBoolInput
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

export type EncryptedInputsToInputs<T> = T extends Primitive
  ? LiteralToPrimitive<T>
  : T extends EncryptedItemInput
    ? EncryptedInputToInputMap<T>
    : {
        [K in keyof T]: EncryptedInputsToInputs<T[K]>;
      };

type testA = EncryptedInputToEncryptableMap<EncryptedBoolInput>;
type testB = EncryptedInputToEncryptableMap<EncryptedUint8Input>;
type testC = EncryptedInputToEncryptableMap<EncryptedUint16Input>;
type testD = EncryptedInputToEncryptableMap<EncryptedUint32Input>;
type testE = EncryptedInputToEncryptableMap<EncryptedUint64Input>;
type testF = EncryptedInputToEncryptableMap<EncryptedUint128Input>;
type testG = EncryptedInputToEncryptableMap<EncryptedAddressInput>;

type test = FhenixAbiParametersToPrimitiveTypes<
  [
    {
      name: 'abc';
      type: 'uint256';
    },
    {
      name: 'foo';
      type: 'bool';
      internalType: 'struct InEbool';
    },
    {
      name: 'bar';
      type: 'uint8';
      internalType: 'struct InEuint8';
    },
  ]
>;

export type ContractParameters<
  abi extends Abi | readonly unknown[] = Abi, // `readonly unknown[]` allows for non-const asserted types
  functionName extends string = string,
  abiStateMutability extends AbiStateMutability = AbiStateMutability,
  args extends readonly unknown[] | undefined = readonly [],
  ///
  functionNames extends string = abi extends Abi ? ExtractAbiFunctionNames<abi, abiStateMutability> : string,
> = {
  functionName:
    | functionNames // show all values
    | (functionName extends functionNames ? functionName : never) // infer value (if valid)
    | (Abi extends abi ? string : never); // fallback if `abi` is declared as `Abi`
} & GetArgs<abi, functionName, args>;

type GetArgs<
  abi extends Abi | readonly unknown[] = Abi, // `readonly unknown[]` allows for non-const asserted types
  functionName extends string = string,
  args extends readonly unknown[] | undefined = readonly [],
  ///
  abiFunction extends AbiFunction = abi extends Abi ? ExtractAbiFunction<abi, functionName> : AbiFunction,
  primitiveTypes = FhenixAbiParametersToPrimitiveTypes<abiFunction['inputs']>,
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

export type CofheInputArgs<abi extends Abi | readonly unknown[] = Abi, functionName extends string = string> = GetArgs<
  abi,
  functionName
>['args'];

export type CofheInputArgsPreTransform<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends string = string,
> = EncryptedInputsToInputs<CofheInputArgs<abi, functionName>>;

type PartialBy<TType, TKeys extends keyof TType> = ExactPartial<Pick<TType, TKeys>> & Omit<TType, TKeys>;
type ExactPartial<T> = { [K in keyof T]?: T[K] | undefined };

type MaybePartialBy<TType, TKeys extends string> = TKeys extends keyof TType ? PartialBy<TType, TKeys> : TType;

type ReadonlyWiden<TType> =
  | (TType extends Function ? TType : never)
  | (TType extends ResolvedRegister['bigIntType'] ? bigint : never)
  | (TType extends boolean ? boolean : never)
  | (TType extends ResolvedRegister['intType'] ? number : never)
  | (TType extends string
      ? TType extends Address
        ? Address
        : TType extends ResolvedRegister['bytesType']['inputs']
          ? ResolvedRegister['bytesType']
          : string
      : never)
  | (TType extends readonly [] ? readonly [] : never)
  | (TType extends Record<string, unknown> ? { [K in keyof TType]: ReadonlyWiden<TType[K]> } : never)
  | (TType extends { length: number }
      ? {
          [K in keyof TType]: ReadonlyWiden<TType[K]>;
        } extends infer Val extends unknown[]
        ? readonly [...Val]
        : never
      : never);

type AbiBasicType = Exclude<AbiType, SolidityTuple | SolidityArray>;

type AbiComponentsToPrimitiveType<
  components extends readonly AbiParameter[],
  abiParameterKind extends AbiParameterKind,
> = components extends readonly []
  ? []
  : // Compare the original set of names to a "validated"
    // set where each name is coerced to a string and undefined|"" are excluded
    components[number]['name'] extends Exclude<components[number]['name'] & string, undefined | ''>
    ? // If all the original names are present, all tuple parameters are named so return as object
      {
        [component in components[number] as component['name'] & {}]: AbiParameterToPrimitiveType<
          component,
          abiParameterKind
        >;
      }
    : // Otherwise, has unnamed tuple parameters so return as array
      {
        [key in keyof components]: AbiParameterToPrimitiveType<components[key], abiParameterKind>;
      };

type componentsTest = AbiComponentsToPrimitiveType<
  [
    {
      name: 'ctHash';
      type: 'uint256';
      internalType: 'uint256';
    },
    {
      name: 'securityZone';
      type: 'uint8';
      internalType: 'uint8';
    },
    {
      name: 'utype';
      type: 'uint8';
      internalType: 'uint8';
    },
    {
      name: 'signature';
      type: 'bytes';
      internalType: 'bytes';
    },
  ],
  AbiParameterKind
>;

/**
 * First, infer `Head` against a known size type (either fixed-length array value or `""`).
 *
 * | Input           | Head         |
 * | --------------- | ------------ |
 * | `string[]`      | `string`     |
 * | `string[][][3]` | `string[][]` |
 */
type MaybeExtractArrayParameterType<type> = type extends `${infer head}[${'' | `${SolidityFixedArrayRange}`}]`
  ? //   * Then, infer in the opposite direction, using the known `head` to infer the exact `size` value.
    //   *
    //   * | Input        | Size |
    //   * | ------------ | ---- |
    //   * | `${head}[]`  | `""` |
    //   * | `${head}[3]` | `3`  |
    //   */
    type extends `${head}[${infer size}]`
    ? [head, size]
    : undefined
  : undefined;

type extractedArrayParameterType = MaybeExtractArrayParameterType<'struct InEuint32[2]'>;

type AbiArrayToPrimitiveType<
  abiParameter extends AbiParameter | { name: string; type: unknown },
  abiParameterKind extends AbiParameterKind,
  head extends string,
  size,
> = size extends keyof SolidityFixedArraySizeLookup
  ? // Check if size is within range for fixed-length arrays, if so create a tuple.
    Tuple<
      AbiParameterToPrimitiveType<Merge<abiParameter, { type: head }>, abiParameterKind>,
      SolidityFixedArraySizeLookup[size]
    >
  : // Otherwise, create an array. Tuples and arrays are created with `[${Size}]` popped off the end
    // and passed back into the function to continue reducing down to the basic types found in Step 1.
    readonly AbiParameterToPrimitiveType<Merge<abiParameter, { type: head }>, abiParameterKind>[];
