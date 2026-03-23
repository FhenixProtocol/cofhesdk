function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function serializeIfBigint(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Converts `bigint` values to strings so structures can safely be used in e.g. react-query keys.
 *
 * - Arrays are mapped recursively
 * - Plain objects are copied recursively
 * - All other values are returned as-is (except bigint -> string)
 */
export function serializeBigintRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializeBigintRecursively);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) out[key] = serializeBigintRecursively(nested);
    return out;
  }
  return serializeIfBigint(value);
}
