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

const zPermitWithDefaults = z.object({
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

const zPermitWithSealingKeys = zPermitWithDefaults.extend({
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

type zPermitType = z.infer<typeof zPermitWithDefaults>;

/**
 * Permits allow a hook into an optional external validator contract,
 * this check ensures that IF an external validator is applied, that both `revokerData` and `revokerContract` are populated,
 * ELSE ensures that both `revokerData` and `revokerContract` are empty
 */
const ExternalValidatorRefinement = [
  (data: Pick<zPermitType, 'revokerData' | 'revokerContract'>) =>
    (data.revokerData !== 0 && data.revokerContract !== zeroAddress) ||
    (data.revokerData === 0 && data.revokerContract === zeroAddress),
  {
    error: 'ACP external validator :: revokerData and revokerContract must either both be set or both be unset.',
    path: ['revokerData', 'revokerContract'] as string[],
  },
] as const;

/**
 * Prevents sharable permit from having the same issuer and recipient
 */
const RecipientRefinement = [
  (data: Pick<zPermitType, 'issuer' | 'recipient'>) => data.issuer !== data.recipient,
  {
    error: 'Sharing permit :: issuer and recipient must not be the same',
    path: ['issuer', 'recipient'] as string[],
  },
] as const;

// ============================================================================
// SELF PERMIT VALIDATORS
// ============================================================================

/**
 * Validator for self permit creation options
 */
export const SelfPermitOptionsValidator = z
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
 * Validator for fully formed self permits
 */
export const SelfPermitValidator = zPermitWithSealingKeys
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
// SHARING PERMIT VALIDATORS
// ============================================================================

/**
 * Validator for sharing permit creation options
 */
export const SharingPermitOptionsValidator = z
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
 * Validator for fully formed sharing permits
 */
export const SharingPermitValidator = zPermitWithSealingKeys
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
// IMPORT/RECIPIENT PERMIT VALIDATORS
// ============================================================================

/**
 * Validator for import permit creation options (recipient receiving shared permit)
 */
export const ImportPermitOptionsValidator = z
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
 * Validator for fully formed import/recipient permits
 */
export const ImportPermitValidator = zPermitWithSealingKeys
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
 * Validates self permit creation options
 */
export const validateSelfPermitOptions = (options: any) => {
  return safeParseAndThrowFormatted(SelfPermitOptionsValidator, options, 'Invalid self permit options');
};
/**
 * Validates sharing permit creation options
 */
export const validateSharingPermitOptions = (options: any) => {
  return safeParseAndThrowFormatted(SharingPermitOptionsValidator, options, 'Invalid sharing permit options');
};

/**
 * Validates import permit creation options
 */
export const validateImportPermitOptions = (options: any) => {
  return safeParseAndThrowFormatted(ImportPermitOptionsValidator, options, 'Invalid import permit options');
};

/**
 * Validates a fully formed self permit
 */
export const validateSelfPermit = (permit: any) => {
  return safeParseAndThrowFormatted(SelfPermitValidator, permit, 'Invalid self permit');
};

/**
 * Validates a fully formed sharing permit
 */
export const validateSharingPermit = (permit: any) => {
  return safeParseAndThrowFormatted(SharingPermitValidator, permit, 'Invalid sharing permit');
};

/**
 * Validates a fully formed import/recipient permit
 */
export const validateImportPermit = (permit: any) => {
  return safeParseAndThrowFormatted(ImportPermitValidator, permit, 'Invalid import permit');
};

/**
 * Simple validation functions for common checks
 */
export const ValidationUtils = {
  /**
   * Check if permit is expired
   */
  isExpired: (permit: ACP): boolean => {
    return permit.expiration < Math.floor(Date.now() / 1000);
  },

  /**
   * Check if permit is signed by the active party
   */
  isSigned: (permit: ACP): boolean => {
    if (permit.type === 'self' || permit.type === 'sharing') {
      return permit.issuerSignature !== '0x';
    }
    if (permit.type === 'recipient') {
      return permit.recipientSignature !== '0x';
    }
    return false;
  },

  /**
   * Checks that a permit is signed and not expired.
   */
  isSignedAndNotExpired: (permit: ACP): ValidationResult => {
    if (ValidationUtils.isExpired(permit)) {
      return { valid: false, error: 'expired' };
    }
    if (!ValidationUtils.isSigned(permit)) {
      return { valid: false, error: 'not-signed' };
    }
    return { valid: true, error: null };
  },

  /**
   * Asserts that a permit is signed and not expired.
   *
   * Throws `Error` with message:
   * - `ACP is expired`
   * - `ACP is not signed`
   */
  assertSignedAndNotExpired: (permit: ACP): void => {
    const result = ValidationUtils.isSignedAndNotExpired(permit);
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

  isValid: (permit: ACP): ValidationResult => {
    const schema =
      permit.type === 'self'
        ? SelfPermitValidator
        : permit.type === 'sharing'
          ? SharingPermitValidator
          : permit.type === 'recipient'
            ? ImportPermitValidator
            : null;

    if (schema == null) return { valid: false, error: 'invalid-schema' };

    const schemaResult = schema.safeParse(permit);
    if (!schemaResult.success) return { valid: false, error: 'invalid-schema' };

    return ValidationUtils.isSignedAndNotExpired(permit);
  },
};
