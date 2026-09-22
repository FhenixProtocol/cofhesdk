/**
 * The encrypted-type inventory, mirroring `type` declarations in cofhe-contracts FHE.sol.
 * Kept as data rather than regex so every rule agrees on what "encrypted" means.
 */

/** Live handles: usable operands for FHE math. Illegal at external boundaries. */
export const BASE_ENCRYPTED_TYPES = [
  'ebool',
  'euint8',
  'euint16',
  'euint32',
  'euint64',
  'euint128',
  'eaddress',
] as const;

export type BaseEncryptedType = (typeof BASE_ENCRYPTED_TYPES)[number];

/** Inert wrappers guarding the EOA -> contract boundary (carry a proof). */
export const EXTERNAL_ENCRYPTED_TYPES = BASE_ENCRYPTED_TYPES.map((t) => `external${t[0].toUpperCase()}${t.slice(1)}`);

/** Inert wrappers guarding the contract -> contract boundary. */
export const SHARED_ENCRYPTED_TYPES = BASE_ENCRYPTED_TYPES.map((t) => `shared${t[0].toUpperCase()}${t.slice(1)}`);

const BASE = new Set<string>(BASE_ENCRYPTED_TYPES);
const EXTERNAL = new Set<string>(EXTERNAL_ENCRYPTED_TYPES);
const SHARED = new Set<string>(SHARED_ENCRYPTED_TYPES);

export function isBaseEncryptedType(name: string): boolean {
  return BASE.has(name);
}

export function isSharedEncryptedType(name: string): boolean {
  return SHARED.has(name);
}

export function isExternalEncryptedType(name: string): boolean {
  return EXTERNAL.has(name);
}

/**
 * solc renders user-defined value types as `contract`-free strings such as
 * `euint64` or, when imported through a file-level alias, `FHE.euint64`.
 * Array and mapping wrappers keep the element name intact, so a suffix match
 * on the final identifier segment is enough.
 */
export function typeIdentifier(typeString: string | undefined): string | undefined {
  if (!typeString) return undefined;

  // solc describes a type used as a value (e.g. `sharedEuint64.unwrap`) as the
  // meta-type `type(sharedEuint64)`; unwrap it before anything else.
  let cleaned = typeString.trim();
  const meta = /^type\((.*)\)$/.exec(cleaned);
  if (meta) cleaned = meta[1]!.trim();

  // strip data location and array/pointer decorations solc appends
  cleaned = cleaned.replace(/\b(memory|calldata|storage|pointer|ref)\b/g, '').trim();

  const head = cleaned.split(/[\s[]/)[0] ?? cleaned;
  const seg = head.split('.').pop();
  return seg || undefined;
}
