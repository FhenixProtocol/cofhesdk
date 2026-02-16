import { z } from 'zod';
import { getAddress, isAddress, isHex, zeroAddress, type Hex } from 'viem';
import type { Permit, ValidationResult } from './types.js';

const SerializedSealingPair = z.object({
  privateKey: z.string(),
  publicKey: z.string(),
});

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

const zPermitWithDefaults = z.object({
  name: z.string().optional().default('Unnamed Permit'),
  type: z.enum(['self', 'sharing', 'recipient']),
  issuer: addressNotZeroSchema,
  expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
  recipient: addressSchema.optional().default(zeroAddress),
  validatorId: z.int().optional().default(0),
  validatorContract: addressSchema.optional().default(zeroAddress),
  issuerSignature: bytesSchema.optional().default('0x'),
  recipientSignature: bytesSchema.optional().default('0x'),
});

const zPermitWithSealingPair = zPermitWithDefaults.extend({
  sealingPair: SerializedSealingPair.optional(),
});

type zPermitType = z.infer<typeof zPermitWithDefaults>;

/**
 * Permits allow a hook into an optional external validator contract,
 * this check ensures that IF an external validator is applied, that both `validatorId` and `validatorContract` are populated,
 * ELSE ensures that both `validatorId` and `validatorContract` are empty
 */
const ExternalValidatorRefinement = [
  (data: zPermitType) =>
    (data.validatorId !== 0 && data.validatorContract !== zeroAddress) ||
    (data.validatorId === 0 && data.validatorContract === zeroAddress),
  {
    error: 'Permit external validator :: validatorId and validatorContract must either both be set or both be unset.',
    path: ['validatorId', 'validatorContract'] as string[],
  },
] as const;

/**
 * Prevents sharable permit from having the same issuer and recipient
 */
const RecipientRefinement = [
  (data: zPermitType) => data.issuer !== data.recipient,
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
    name: z.string().optional().default('Unnamed Permit'),
    expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
    recipient: addressSchema.optional().default(zeroAddress),
    validatorId: z.int().optional().default(0),
    validatorContract: addressSchema.optional().default(zeroAddress),
    issuerSignature: bytesSchema.optional().default('0x'),
    recipientSignature: bytesSchema.optional().default('0x'),
  })
  .refine(...ExternalValidatorRefinement);

/**
 * Validator for fully formed self permits
 */
export const SelfPermitValidator = zPermitWithSealingPair
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
    name: z.string().optional().default('Unnamed Permit'),
    expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
    validatorId: z.int().optional().default(0),
    validatorContract: addressSchema.optional().default(zeroAddress),
    issuerSignature: bytesSchema.optional().default('0x'),
    recipientSignature: bytesSchema.optional().default('0x'),
  })
  .refine(...RecipientRefinement)
  .refine(...ExternalValidatorRefinement);

/**
 * Validator for fully formed sharing permits
 */
export const SharingPermitValidator = zPermitWithSealingPair
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
    name: z.string().optional().default('Unnamed Permit'),
    expiration: z.int().optional().default(DEFAULT_EXPIRATION_FN),
    validatorId: z.int().optional().default(0),
    validatorContract: addressSchema.optional().default(zeroAddress),
    issuerSignature: bytesNotEmptySchema.optional().default('0x'),
    recipientSignature: bytesSchema.optional().default('0x'),
  })
  .refine(...ExternalValidatorRefinement);

/**
 * Validator for fully formed import/recipient permits
 */
export const ImportPermitValidator = zPermitWithSealingPair
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

const safeParseAndThrowFormatted = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
};

/**
 * Validates self permit creation options
 */
export const validateSelfPermitOptions = (options: any) => {
  return safeParseAndThrowFormatted(SelfPermitOptionsValidator, options);
};
/**
 * Validates sharing permit creation options
 */
export const validateSharingPermitOptions = (options: any) => {
  return safeParseAndThrowFormatted(SharingPermitOptionsValidator, options);
};

/**
 * Validates import permit creation options
 */
export const validateImportPermitOptions = (options: any) => {
  return safeParseAndThrowFormatted(ImportPermitOptionsValidator, options);
};

/**
 * Validates a fully formed self permit
 */
export const validateSelfPermit = (permit: any) => {
  return safeParseAndThrowFormatted(SelfPermitValidator, permit);
};

/**
 * Validates a fully formed sharing permit
 */
export const validateSharingPermit = (permit: any) => {
  return safeParseAndThrowFormatted(SharingPermitValidator, permit);
};

/**
 * Validates a fully formed import/recipient permit
 */
export const validateImportPermit = (permit: any) => {
  return safeParseAndThrowFormatted(ImportPermitValidator, permit);
};

/**
 * Simple validation functions for common checks
 */
export const ValidationUtils = {
  /**
   * Check if permit is expired
   */
  isExpired: (permit: Permit): boolean => {
    return permit.expiration < Math.floor(Date.now() / 1000);
  },

  /**
   * Check if permit is signed by the active party
   */
  isSigned: (permit: Permit): boolean => {
    if (permit.type === 'self' || permit.type === 'sharing') {
      return permit.issuerSignature !== '0x';
    }
    if (permit.type === 'recipient') {
      return permit.recipientSignature !== '0x';
    }
    return false;
  },

  /**
   * Overall validity checker of a permit
   */
  isValid: (permit: Permit): ValidationResult => {
    if (ValidationUtils.isExpired(permit)) {
      return { valid: false, error: 'expired' };
    }
    if (!ValidationUtils.isSigned(permit)) {
      return { valid: false, error: 'not-signed' };
    }
    return { valid: true, error: null };
  },
};
