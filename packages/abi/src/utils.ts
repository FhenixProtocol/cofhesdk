import type {
  AbiType,
  Address,
  ResolvedRegister,
  SolidityArray,
  SolidityFixedArrayRange,
  SolidityTuple,
} from 'abitype';

export type Error<messages extends string | string[]> = messages extends string
  ? [
      // Surrounding with array to prevent `messages` from being widened to `string`
      `Error: ${messages}`,
    ]
  : {
      [key in keyof messages]: messages[key] extends infer message extends string ? `Error: ${message}` : never;
    };

type PartialBy<TType, TKeys extends keyof TType> = ExactPartial<Pick<TType, TKeys>> & Omit<TType, TKeys>;
type ExactPartial<T> = { [K in keyof T]?: T[K] | undefined };

export type MaybePartialBy<TType, TKeys extends string> = TKeys extends keyof TType ? PartialBy<TType, TKeys> : TType;

export type ReadonlyWiden<TType> =
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

export type AbiBasicType = Exclude<AbiType, SolidityTuple | SolidityArray>;

/**
 * First, infer `Head` against a known size type (either fixed-length array value or `""`).
 *
 * | Input           | Head         |
 * | --------------- | ------------ |
 * | `string[]`      | `string`     |
 * | `string[][][3]` | `string[][]` |
 */
export type MaybeExtractArrayParameterType<type> = type extends `${infer head}[${'' | `${SolidityFixedArrayRange}`}]`
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

export type IsUnion<T, C = T> = T extends C ? ([C] extends [T] ? false : true) : never;
export type UnionToTuple<U, Last = LastInUnion<U>> = [U] extends [never]
  ? []
  : [...UnionToTuple<Exclude<U, Last>>, Last];
type LastInUnion<U> =
  UnionToIntersection<U extends unknown ? (x: U) => 0 : never> extends (x: infer L) => 0 ? L : never;
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => 0 : never) extends (arg: infer I) => 0 ? I : never;

/**
 * Create tuple of {@link type} type with {@link size} size
 *
 * @param Type - Type of tuple
 * @param Size - Size of tuple
 * @returns Tuple of {@link type} type with {@link size} size
 *
 * @example
 * type Result = Tuple<string, 2>
 * //   ^? type Result = [string, string]
 */
// https://github.com/Microsoft/TypeScript/issues/26223#issuecomment-674500430
export type Tuple<type, size extends number> = size extends size
  ? number extends size
    ? type[]
    : _TupleOf<type, size, []>
  : never;
type _TupleOf<length, size extends number, acc extends readonly unknown[]> = acc['length'] extends size
  ? acc
  : _TupleOf<length, size, readonly [length, ...acc]>;

/**
 * Merges two object types into new type
 *
 * @param object1 - Object to merge into
 * @param object2 - Object to merge and override keys from {@link object1}
 * @returns New object type with keys from {@link object1} and {@link object2}. If a key exists in both {@link object1} and {@link object2}, the key from {@link object2} will be used.
 *
 * @example
 * type Result = Merge<{ foo: string }, { foo: number; bar: string }>
 * //   ^? type Result = { foo: number; bar: string }
 */
export type Merge<object1, object2> = Omit<object1, keyof object2> & object2;
