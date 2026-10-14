import { z } from 'zod';
import { getAddress, isAddress, isHex, zeroAddress, type Hex } from 'viem';
import type { ACP, ValidationResult } from './types.js';

export const addressSchema = z
  .string()
  .refine((val) => isAddress(val), {
    error: 'Invalid address',
  })
  .transform((val): Hex => getAddress(val));

export const addressNotZeroSchema = addressSchema.refine((val) => val !== zeroAddress, {
  error: 'Must not be zeroAddress',
});

export const bytesSchema = z.custom<Hex>(
  (val) => {
    return typeof val === 'string' && isHex(val);
  },
  {
    message: 'Invalid hex value',
  }
);

export const bytesNotEmptySchema = bytesSchema.refine((val) => val !== '0x', {
  error: 'Must not be empty',
});

const DEFAULT_EXPIRATION_FN = () => Math.round(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days from now

/** (scope) ciphertext handles — bytes32 hex strings */
export const handlesSchema = z
  .array(z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid handle: expected 32-byte hex') as z.ZodType<Hex>)
  .optional()
  .default([]);

/** (scope) contract addresses */
export const contractsSchema = z.array(addressSchema).optional().default([]);

/**
 * Context-sensitive `global` default: with no scope arrays it defaults to true
 * (V2 behavior); when contracts/handles are provided it defaults to false
 * (narrowest matching scope).
 */
/**
 * Scope derivation + per-scope array rules (client-side validation, per review):
 *  - explicit `scope` wins; otherwise derived: contracts -> Contract, handles -> Handles, else Global
 *  - Global   => contracts and handles must be empty
 *  - Contract => contracts non-empty, handles empty
 *  - Handles  => handles non-empty, contracts empty
 * Exactly one scope mode per ACP — no overlapping scopes.
 */
const SCOPE_GLOBAL = 0;
const SCOPE_CONTRACT = 1;
const SCOPE_HANDLES = 2;

const ScopeConsistencyRefinement = [
  (data: { scope: number; contracts: Hex[]; handles: Hex[] }) =>
    (data.scope === SCOPE_GLOBAL && data.contracts.length === 0 && data.handles.length === 0) ||
    (data.scope === SCOPE_CONTRACT && data.contracts.length > 0 && data.handles.length === 0) ||
    (data.scope === SCOPE_HANDLES && data.handles.length > 0 && data.contracts.length === 0),
  {
    error:
      'ACP scope :: arrays must match the scope mode (Global: both empty; Contract: contracts only; Handles: handles only)',
    path: ['scope'] as string[],
  },
] as const;

const withDerivedScope = <T extends { scope?: number; contracts: Hex[]; handles: Hex[] }>(data: T) => ({
  ...data,
  scope:
    data.scope ?? (data.contracts.length > 0 ? SCOPE_CONTRACT : data.handles.length > 0 ? SCOPE_HANDLES : SCOPE_GLOBAL),
});

const zACPWithDefaults = z.object({
  name: z.string().optional().default('Unnamed ACP'),
  type: z.enum(['self', 'sharing', 'recipient']),
  issuer: addressNotZeroSchema,
  expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
  recipient: addressSchema.optional().default(zeroAddress),
  revokerData: z.int().optional().default(0),
  revokerContract: addressSchema.optional().default(zeroAddress),
  scope: z.int().min(0).max(2).optional().default(0),
  contracts: contractsSchema,
  handles: handlesSchema,
  issuerSignature: bytesSchema.optional().default('0x'),
  recipientSignature: bytesSchema.optional().default('0x'),
});

const zACPWithSealingKeys = zACPWithDefaults.extend({
  /** X25519 private key, 0x-prefixed 32-byte hex; never leaves the client */
  sealingPrivateKey: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid sealing private key')
    .optional(),
  sealingKey: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid sealing key')
    .optional(),
});

type zACPType = z.infer<typeof zACPWithDefaults>;

/**
 * ACPs allow a hook into an optional external revoker contract,
 * this check ensures that IF an external revoker is applied, that both `revokerData` and `revokerContract` are populated,
 * ELSE ensures that both `revokerData` and `revokerContract` are empty
 */
const ExternalValidatorRefinement = [
  (data: Pick<zACPType, 'revokerData' | 'revokerContract'>) =>
    (data.revokerData !== 0 && data.revokerContract !== zeroAddress) ||
    (data.revokerData === 0 && data.revokerContract === zeroAddress),
  {
    error: 'ACP external revoker :: revokerData and revokerContract must either both be set or both be unset.',
    path: ['revokerData', 'revokerContract'] as string[],
  },
] as const;

/**
 * Prevents sharable acp from having the same issuer and recipient
 */
const RecipientRefinement = [
  (data: Pick<zACPType, 'issuer' | 'recipient'>) => data.issuer !== data.recipient,
  {
    error: 'Sharing acp :: issuer and recipient must not be the same',
    path: ['issuer', 'recipient'] as string[],
  },
] as const;

// ============================================================================
// SELF ACP VALIDATORS
// ============================================================================

/**
 * Validator for self acp creation options
 */
export const SelfACPOptionsValidator = z
  .object({
    type: z.literal('self').optional().default('self'),
    issuer: addressNotZeroSchema,
    name: z.string().optional().default('Unnamed ACP'),
    expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
    recipient: addressSchema.optional().default(zeroAddress),
    revokerData: z.int().optional().default(0),
    revokerContract: addressSchema.optional().default(zeroAddress),
    scope: z.int().min(0).max(2).optional(),
    contracts: contractsSchema,
    handles: handlesSchema,
    issuerSignature: bytesSchema.optional().default('0x'),
    recipientSignature: bytesSchema.optional().default('0x'),
  })
  .refine(...ExternalValidatorRefinement)
  .transform(withDerivedScope)
  .refine(...ScopeConsistencyRefinement);

/**
 * Validator for fully formed self acps
 */
export const SelfACPValidator = zACPWithSealingKeys
  .refine((data) => data.type === 'self', {
    error: "Type must be 'self'",
  })
  .refine((data) => data.recipient === zeroAddress, {
    error: 'Recipient must be zeroAddress',
  })
  .refine((data) => data.issuerSignature !== '0x', {
    error: 'IssuerSignature must be populated',
  })
  .refine((data) => data.recipientSignature === '0x', {
    error: 'RecipientSignature must be empty',
  })
  .refine(...ExternalValidatorRefinement);

// ============================================================================
// SHARING ACP VALIDATORS
// ============================================================================

/**
 * Validator for sharing acp creation options
 */
export const SharingACPOptionsValidator = z
  .object({
    type: z.literal('sharing').optional().default('sharing'),
    issuer: addressNotZeroSchema,
    recipient: addressNotZeroSchema,
    name: z.string().optional().default('Unnamed ACP'),
    expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
    revokerData: z.int().optional().default(0),
    revokerContract: addressSchema.optional().default(zeroAddress),
    scope: z.int().min(0).max(2).optional(),
    contracts: contractsSchema,
    handles: handlesSchema,
    issuerSignature: bytesSchema.optional().default('0x'),
    recipientSignature: bytesSchema.optional().default('0x'),
  })
  .refine(...RecipientRefinement)
  .refine(...ExternalValidatorRefinement)
  .transform(withDerivedScope)
  .refine(...ScopeConsistencyRefinement);

/**
 * Validator for fully formed sharing acps
 */
export const SharingACPValidator = zACPWithSealingKeys
  .refine((data) => data.type === 'sharing', {
    error: "Type must be 'sharing'",
  })
  .refine((data) => data.recipient !== zeroAddress, {
    error: 'Recipient must not be zeroAddress',
  })
  .refine((data) => data.issuerSignature !== '0x', {
    error: 'IssuerSignature must be populated',
  })
  .refine((data) => data.recipientSignature === '0x', {
    error: 'RecipientSignature must be empty',
  })
  .refine(...ExternalValidatorRefinement);

// ============================================================================
// IMPORT/RECIPIENT ACP VALIDATORS
// ============================================================================

/**
 * Validator for import acp creation options (recipient receiving shared acp)
 */
export const ImportACPOptionsValidator = z
  .object({
    type: z.literal('recipient').optional().default('recipient'),
    issuer: addressNotZeroSchema,
    recipient: addressNotZeroSchema,
    name: z.string().optional().default('Unnamed ACP'),
    expiration: z.int(),
    revokerData: z.int().optional().default(0),
    revokerContract: addressSchema.optional().default(zeroAddress),
    scope: z.int().min(0).max(2).optional(),
    contracts: contractsSchema,
    handles: handlesSchema,
    issuerSignature: bytesNotEmptySchema,
    recipientSignature: bytesSchema.optional().default('0x'),
  })
  .refine(...ExternalValidatorRefinement)
  .transform(withDerivedScope)
  .refine(...ScopeConsistencyRefinement);

/**
 * Validator for fully formed import/recipient acps
 */
export const ImportACPValidator = zACPWithSealingKeys
  .refine((data) => data.type === 'recipient', {
    error: "Type must be 'recipient'",
  })
  .refine((data) => data.recipient !== zeroAddress, {
    error: 'Recipient must not be zeroAddress',
  })
  .refine((data) => data.issuerSignature !== '0x', {
    error: 'IssuerSignature must be populated',
  })
  .refine((data) => data.recipientSignature !== '0x', {
    error: 'RecipientSignature must be populated',
  })
  .refine(...ExternalValidatorRefinement);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

const safeParseAndThrowFormatted = <T extends z.ZodTypeAny>(schema: T, data: unknown, message: string): z.output<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${message}: ${z.prettifyError(result.error)}`, { cause: result.error });
  }
  return result.data;
};

/**
 * Validates self acp creation options
 */
export const validateSelfACPOptions = (options: any) => {
  return safeParseAndThrowFormatted(SelfACPOptionsValidator, options, 'Invalid self acp options');
};
/**
 * Validates sharing acp creation options
 */
export const validateSharingACPOptions = (options: any) => {
  return safeParseAndThrowFormatted(SharingACPOptionsValidator, options, 'Invalid sharing acp options');
};

/**
 * Validates import acp creation options
 */
export const validateImportACPOptions = (options: any) => {
  return safeParseAndThrowFormatted(ImportACPOptionsValidator, options, 'Invalid import acp options');
};

/**
 * Validates a fully formed self acp
 */
export const validateSelfACP = (acp: any) => {
  return safeParseAndThrowFormatted(SelfACPValidator, acp, 'Invalid self acp');
};

/**
 * Validates a fully formed sharing acp
 */
export const validateSharingACP = (acp: any) => {
  return safeParseAndThrowFormatted(SharingACPValidator, acp, 'Invalid sharing acp');
};

/**
 * Validates a fully formed import/recipient acp
 */
export const validateImportACP = (acp: any) => {
  return safeParseAndThrowFormatted(ImportACPValidator, acp, 'Invalid import acp');
};

/**
 * Simple validation functions for common checks
 */
export const ValidationUtils = {
  /**
   * Check if acp is expired
   */
  isExpired: (acp: ACP): boolean => {
    return acp.expiration < Math.floor(Date.now() / 1000);
  },

  /**
   * Check if acp is signed by the active party
   */
  isSigned: (acp: ACP): boolean => {
    if (acp.type === 'self' || acp.type === 'sharing') {
      return acp.issuerSignature !== '0x';
    }
    if (acp.type === 'recipient') {
      return acp.recipientSignature !== '0x';
    }
    return false;
  },

  /**
   * Checks that an ACP is signed and not expired.
   */
  isSignedAndNotExpired: (acp: ACP): ValidationResult => {
    if (ValidationUtils.isExpired(acp)) {
      return { valid: false, error: 'expired' };
    }
    if (!ValidationUtils.isSigned(acp)) {
      return { valid: false, error: 'not-signed' };
    }
    return { valid: true, error: null };
  },

  /**
   * Asserts that an ACP is signed and not expired.
   *
   * Throws `Error` with message:
   * - `ACP is expired`
   * - `ACP is not signed`
   */
  assertSignedAndNotExpired: (acp: ACP): void => {
    const result = ValidationUtils.isSignedAndNotExpired(acp);
    if (result.valid) return;

    if (result.error === 'expired') {
      throw new Error('ACP is expired');
    }
    if (result.error === 'not-signed') {
      throw new Error('ACP is not signed');
    }

    // Should be unreachable, but keeps this future-proof.
    throw new Error('ACP is invalid');
  },

  isValid: (acp: ACP): ValidationResult => {
    const schema =
      acp.type === 'self'
        ? SelfACPValidator
        : acp.type === 'sharing'
          ? SharingACPValidator
          : acp.type === 'recipient'
            ? ImportACPValidator
            : null;

    if (schema == null) return { valid: false, error: 'invalid-schema' };

    const schemaResult = schema.safeParse(acp);
    if (!schemaResult.success) return { valid: false, error: 'invalid-schema' };

    return ValidationUtils.isSignedAndNotExpired(acp);
  },
};
