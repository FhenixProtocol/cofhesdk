import type {
  EncryptedAddressInput,
  EncryptedBoolInput,
  EncryptedUint128Input,
  EncryptedUint16Input,
  EncryptedUint256Input,
  EncryptedUint32Input,
  EncryptedUint64Input,
  EncryptedUint8Input,
  FheTypes,
} from '@cofhe/sdk';
import type {
  AbiParameter,
  AbiParameterKind,
  AbiTypeToPrimitiveType,
  SolidityTuple,
  ResolvedRegister,
  SolidityFixedArraySizeLookup,
} from 'abitype';
import type { AbiBasicType, Error, Merge, Tuple, MaybeExtractArrayParameterType } from './utils';

export type EBool = {
  ctHash: bigint;
  utype: FheTypes.Bool;
};
export type EUint8 = {
  ctHash: bigint;
  utype: FheTypes.Uint8;
};
export type EUint16 = {
  ctHash: bigint;
  utype: FheTypes.Uint16;
};
export type EUint32 = {
  ctHash: bigint;
  utype: FheTypes.Uint32;
};
export type EUint64 = {
  ctHash: bigint;
  utype: FheTypes.Uint64;
};
export type EUint128 = {
  ctHash: bigint;
  utype: FheTypes.Uint128;
};
export type EUint256 = {
  ctHash: bigint;
  utype: FheTypes.Uint256;
};
export type EAddress = {
  ctHash: bigint;
  utype: FheTypes.Uint160;
};
export type EncryptedReturnType = EBool | EUint8 | EUint16 | EUint32 | EUint64 | EUint128 | EUint256 | EAddress;

export type FhenixInternalTypeMap = {
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

export type FhenixInternalTypeMapUnion = keyof FhenixInternalTypeMap;

export type CofheAbiParameterToPrimitiveType<
  abiParameter extends AbiParameter | { name: string; type: unknown; internalType?: unknown },
  abiParameterKind extends AbiParameterKind = AbiParameterKind,
  // 1. Check to see if type is basic (not tuple or array) and can be looked up immediately.
> = abiParameter['internalType'] extends FhenixInternalTypeMapUnion
  ? FhenixInternalTypeMap[abiParameter['internalType']]
  : abiParameter['type'] extends AbiBasicType
    ? AbiTypeToPrimitiveType<abiParameter['type'], abiParameterKind>
    : // 2. Check if type is tuple and covert each component
      abiParameter extends {
          type: SolidityTuple;
          components: infer components extends readonly AbiParameter[];
        }
      ? CofheAbiComponentsToPrimitiveType<components, abiParameterKind>
      : // 2.5 Check if type is array of fhenix types (struct InEuint32[2])
        MaybeExtractArrayParameterType<abiParameter['internalType']> extends [
            infer head extends FhenixInternalTypeMapUnion,
            infer size,
          ]
        ? CofheArrayToPrimitiveType<head, size>
        : // 3. Check if type is array.
          MaybeExtractArrayParameterType<abiParameter['type']> extends [infer head extends string, infer size]
          ? CofheAbiArrayToPrimitiveType<abiParameter, abiParameterKind, head, size>
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

export type CofheAbiParametersToPrimitiveTypes<
  abiParameters extends readonly AbiParameter[],
  abiParameterKind extends AbiParameterKind = AbiParameterKind,
> = {
  [key in keyof abiParameters]: CofheAbiParameterToPrimitiveType<abiParameters[key], abiParameterKind>;
};

type CofheAbiComponentsToPrimitiveType<
  components extends readonly AbiParameter[],
  abiParameterKind extends AbiParameterKind,
> = components extends readonly []
  ? []
  : // Compare the original set of names to a "validated"
    // set where each name is coerced to a string and undefined|"" are excluded
    components[number]['name'] extends Exclude<components[number]['name'] & string, undefined | ''>
    ? // If all the original names are present, all tuple parameters are named so return as object
      {
        [component in components[number] as component['name'] & {}]: CofheAbiParameterToPrimitiveType<
          component,
          abiParameterKind
        >;
      }
    : // Otherwise, has unnamed tuple parameters so return as array
      {
        [key in keyof components]: CofheAbiParameterToPrimitiveType<components[key], abiParameterKind>;
      };

type CofheArrayToPrimitiveType<
  head extends FhenixInternalTypeMapUnion,
  size,
> = size extends keyof SolidityFixedArraySizeLookup
  ? Tuple<FhenixInternalTypeMap[head], SolidityFixedArraySizeLookup[size]>
  : readonly FhenixInternalTypeMap[head][];

type CofheAbiArrayToPrimitiveType<
  abiParameter extends AbiParameter | { name: string; type: unknown },
  abiParameterKind extends AbiParameterKind,
  head extends string,
  size,
> = size extends keyof SolidityFixedArraySizeLookup
  ? // Check if size is within range for fixed-length arrays, if so create a tuple.
    Tuple<
      CofheAbiParameterToPrimitiveType<Merge<abiParameter, { type: head }>, abiParameterKind>,
      SolidityFixedArraySizeLookup[size]
    >
  : // Otherwise, create an array. Tuples and arrays are created with `[${Size}]` popped off the end
    // and passed back into the function to continue reducing down to the basic types found in Step 1.
    readonly CofheAbiParameterToPrimitiveType<Merge<abiParameter, { type: head }>, abiParameterKind>[];
