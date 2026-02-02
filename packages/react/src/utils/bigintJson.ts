export const BIGINT_JSON_MARKER_KEY = '__bigint__' as const;

type BigintMarker = { [BIGINT_JSON_MARKER_KEY]: string };

type JSONReviver = (key: string, value: unknown) => unknown;
type JSONReplacer = (key: string, value: unknown) => unknown;

export const bigintJSONReviver: JSONReviver = (_key, value) => {
  if (typeof value === 'object' && value !== null && BIGINT_JSON_MARKER_KEY in value) {
    return BigInt((value as BigintMarker)[BIGINT_JSON_MARKER_KEY]);
  }
  return value;
};

export const bigintJSONReplacer: JSONReplacer = (_key, value) => {
  if (typeof value === 'bigint') {
    return { [BIGINT_JSON_MARKER_KEY]: value.toString() } satisfies BigintMarker;
  }
  return value;
};

export const bigintJSONStorageOptions = {
  reviver: bigintJSONReviver,
  replacer: bigintJSONReplacer,
} as const;
