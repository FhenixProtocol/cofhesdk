import {
  Encryptable,
  type EncryptableAddress,
  type EncryptableBool,
  type EncryptableToEncryptedItemInputMap,
  type EncryptableUint128,
  type EncryptableUint16,
  type EncryptableUint32,
  type EncryptableUint64,
  type EncryptableUint8,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedItemInput,
  type EncryptedItemInputs,
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
  AbiParametersToPrimitiveTypes,
  AbiParameterToPrimitiveType,
  AbiStateMutability,
  Address,
  ExtractAbiFunction,
  ExtractAbiFunctionNames,
  ResolvedRegister,
} from 'abitype';
import type { TestABI } from '../test/TestABI';

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

export type FhenixAbiParameterToPrimitiveType<
  abiParameter extends AbiParameter | { name: string; type: unknown; internalType?: unknown },
  abiParameterKind extends AbiParameterKind = AbiParameterKind,
> = abiParameter['internalType'] extends FhenixMapUnion
  ? FhenixMap[abiParameter['internalType']]
  : AbiParameterToPrimitiveType<abiParameter, abiParameterKind>;

export type FhenixAbiParametersToPrimitiveTypes<
  abiParameters extends readonly AbiParameter[],
  abiParameterKind extends AbiParameterKind = AbiParameterKind,
> = {
  [key in keyof abiParameters]: FhenixAbiParameterToPrimitiveType<abiParameters[key], abiParameterKind>;
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
      internalType: 'struct InEBool';
    },
    {
      name: 'bar';
      type: 'uint8';
      internalType: 'struct InEuint8';
    },
  ]
>;

type encryptableTest = EncryptedInputsToEncryptables<test>;

type contractParametersTest = GetArgs<typeof TestABI, 'fnStructContainsEncryptedInput'>['args'];

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
  primitiveTypes = FhenixAbiParametersToPrimitiveTypes<abiFunction['inputs'], 'inputs'>,
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

type IsUnion<T, C = T> = T extends C ? ([C] extends [T] ? false : true) : never;

type UnionToTuple<U, Last = LastInUnion<U>> = [U] extends [never] ? [] : [...UnionToTuple<Exclude<U, Last>>, Last];
type LastInUnion<U> =
  UnionToIntersection<U extends unknown ? (x: U) => 0 : never> extends (x: infer L) => 0 ? L : never;
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => 0 : never) extends (arg: infer I) => 0 ? I : never;

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
