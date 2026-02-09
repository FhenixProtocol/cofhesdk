import type {
  Abi,
  AbiConstructor,
  AbiError,
  AbiEvent,
  AbiFallback,
  AbiFunction,
  AbiParameter,
  AbiParametersToPrimitiveTypes,
  AbiReceive,
  AbiType,
  Address,
  ExtractAbiFunction,
  ResolvedRegister,
  SolidityArray,
  SolidityFixedArrayRange,
  SolidityTuple,
} from 'abitype';

export type ContractReturnType<
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
            ) extends AbiParametersToPrimitiveTypes<abiFunctions[K]['inputs'], 'inputs'>
              ? abiFunctions[K]
              : never;
          }[number] // convert back to union (removes `never` tuple entries: `['foo', never, 'bar'][number]` => `'foo' | 'bar'`)
        : never
      : abiFunction_
    : never,
  outputs extends readonly AbiParameter[] = abiFunction['outputs'],
  primitiveTypes extends readonly unknown[] = AbiParametersToPrimitiveTypes<outputs, 'outputs', true>,
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

// FUNCTIONS

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
export function extractArrayParameterType<T extends string | undefined>(type: T): [T, string | undefined] {
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

type AbiItem = AbiConstructor | AbiError | AbiEvent | AbiFallback | AbiFunction | AbiReceive;

export function isAbiFunction(item: AbiItem | unknown): item is AbiFunction {
  if (typeof item !== 'object' || item === null) return false;
  return 'type' in item && item.type === 'function' && 'name' in item && 'outputs' in item;
}

export function getAbiFunction<TAbi extends Abi | readonly unknown[], TFunctionName extends string>(
  abi: TAbi,
  functionName: TFunctionName
): AbiFunction | undefined {
  return abi.find((item) => {
    const isFunction = isAbiFunction(item);
    if (!isFunction) return false;
    return item.name === functionName;
  }) as AbiFunction | undefined;
}
