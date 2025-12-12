import { z } from 'zod';
import { isAddress, zeroAddress } from 'viem';
import { type Permit, type ValidationResult } from './types.js';
import { is0xPrefixed } from './utils.js';

const SerializedSealingPair = z.object({
  privateKey: z.string(),
  publicKey: z.string(),
});

const DEFAULT_EXPIRATION_FN = () => Math.round(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days from now

const zPermitWithDefaults = z.object({
  name: z.string().optional().default('Unnamed Permit'),
  type: z.enum(['self', 'sharing', 'recipient']),
  issuer: z
    .string()
    .refine((val) => isAddress(val), {
      message: 'Permit issuer :: invalid address',
    })
    .refine((val) => val !== zeroAddress, {
      message: 'Permit issuer :: must not be zeroAddress',
    }),
  expiration: z.number().optional().default(DEFAULT_EXPIRATION_FN),
  recipient: z
    .string()
    .optional()
    .default(zeroAddress)
    .refine((val) => isAddress(val), {
      message: 'Permit recipient :: invalid address',
    }),
  validatorId: z.number().optional().default(0),
  validatorContract: z
    .string()
    .optional()
    .default(zeroAddress)
    .refine((val) => isAddress(val), {
      message: 'Permit validatorContract :: invalid address',
    }),
  issuerSignature: z.string().optional().default('0x'),
  recipientSignature: z.string().optional().default('0x'),
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
const ValidatorContractRefinement = [
  (data: zPermitType) =>
    (data.validatorId !== 0 && data.validatorContract !== zeroAddress) ||
    (data.validatorId === 0 && data.validatorContract === zeroAddress),
  {
    message: 'Permit external validator :: validatorId and validatorContract must either both be set or both be unset.',
    path: ['validatorId', 'validatorContract'] as string[],
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
    issuer: z
      .string()
      .refine((val) => isAddress(val), {
        message: 'Self permit issuer :: invalid address',
      })
      .refine((val) => is0xPrefixed(val), {
        message: 'Self permit issuer :: must be 0x prefixed',
      })
      .refine((val) => val !== zeroAddress, {
        message: 'Self permit issuer :: must not be zeroAddress',
      }),
    name: z.string().optional().default('Unnamed Permit'),
    expiration: z.number().optional().default(DEFAULT_EXPIRATION_FN),
    recipient: z
      .string()
      .optional()
      .default(zeroAddress)
      .refine((val) => isAddress(val), {
        message: 'Self permit recipient :: invalid address',
      })
      .refine((val) => is0xPrefixed(val), {
        message: 'Self permit recipient :: must be 0x prefixed',
      })
      .refine((val) => val === zeroAddress, {
        message: 'Self permit recipient :: must be zeroAddress',
      }),
    validatorId: z.number().optional().default(0),
    validatorContract: z
      .string()
      .optional()
      .default(zeroAddress)
      .refine((val) => isAddress(val), {
        message: 'Self permit validatorContract :: invalid address',
      }),
    issuerSignature: z
      .string()
      .optional()
      .default('0x')
      .refine((val) => is0xPrefixed(val), {
        message: 'Self permit issuerSignature :: must be 0x prefixed',
      }),
    recipientSignature: z
      .string()
      .optional()
      .default('0x')
      .refine((val) => is0xPrefixed(val), {
        message: 'Self permit recipientSignature :: must be 0x prefixed',
      }),
  })
  .refine(...ValidatorContractRefinement);

/**
 * Validator for fully formed self permits
 */
export const SelfPermitValidator = zPermitWithSealingPair
  .refine((data) => data.type === 'self', {
    message: "Self permit :: type must be 'self'",
  })
  .refine((data) => data.recipient === zeroAddress, {
    message: 'Self permit :: recipient must be zeroAddress',
  })
  .refine((data) => data.issuerSignature !== '0x', {
    message: 'Self permit :: issuerSignature must be populated',
  })
  .refine((data) => data.recipientSignature === '0x', {
    message: 'Self permit :: recipientSignature must be empty',
  })
  .refine(...ValidatorContractRefinement);

// ============================================================================
// SHARING PERMIT VALIDATORS
// ============================================================================

/**
 * Validator for sharing permit creation options
 */
export const SharingPermitOptionsValidator = z
  .object({
    type: z.literal('sharing').optional().default('sharing'),
    issuer: z
      .string()
      .refine((val) => isAddress(val), {
        message: 'Sharing permit issuer :: invalid address',
      })
      .refine((val) => is0xPrefixed(val), {
        message: 'Sharing permit issuer :: must be 0x prefixed',
      })
      .refine((val) => val !== zeroAddress, {
        message: 'Sharing permit issuer :: must not be zeroAddress',
      }),
    recipient: z
      .string()
      .refine((val) => isAddress(val), {
        message: 'Sharing permit recipient :: invalid address',
      })
      .refine((val) => is0xPrefixed(val), {
        message: 'Sharing permit recipient :: must be 0x prefixed',
      })
      .refine((val) => val !== zeroAddress, {
        message: 'Sharing permit recipient :: must not be zeroAddress',
      }),
    name: z.string().optional().default('Unnamed Permit'),
    expiration: z.number().optional().default(DEFAULT_EXPIRATION_FN),
    validatorId: z.number().optional().default(0),
    validatorContract: z
      .string()
      .optional()
      .default(zeroAddress)
      .refine((val) => isAddress(val), {
        message: 'Sharing permit validatorContract :: invalid address',
      }),
    issuerSignature: z
      .string()
      .optional()
      .default('0x')
      .refine((val) => is0xPrefixed(val), {
        message: 'Sharing permit issuerSignature :: must be 0x prefixed',
      }),
    recipientSignature: z
      .string()
      .optional()
      .default('0x')
      .refine((val) => is0xPrefixed(val), {
        message: 'Sharing permit recipientSignature :: must be 0x prefixed',
      }),
  })
  .refine(...ValidatorContractRefinement);

/**
 * Validator for fully formed sharing permits
 */
export const SharingPermitValidator = zPermitWithSealingPair
  .refine((data) => data.type === 'sharing', {
    message: "Sharing permit :: type must be 'sharing'",
  })
  .refine((data) => data.recipient !== zeroAddress, {
    message: 'Sharing permit :: recipient must not be zeroAddress',
  })
  .refine((data) => data.issuerSignature !== '0x', {
    message: 'Sharing permit :: issuerSignature must be populated',
  })
  .refine((data) => data.recipientSignature === '0x', {
    message: 'Sharing permit :: recipientSignature must be empty',
  })
  .refine(...ValidatorContractRefinement);

// ============================================================================
// IMPORT/RECIPIENT PERMIT VALIDATORS
// ============================================================================

/**
 * Validator for import permit creation options (recipient receiving shared permit)
 */
export const ImportPermitOptionsValidator = z
  .object({
    type: z.literal('recipient').optional().default('recipient'),
    issuer: z
      .string()
      .refine((val) => isAddress(val), {
        message: 'Import permit issuer :: invalid address',
      })
      .refine((val) => is0xPrefixed(val), {
        message: 'Import permit issuer :: must be 0x prefixed',
      })
      .refine((val) => val !== zeroAddress, {
        message: 'Import permit issuer :: must not be zeroAddress',
      }),
    recipient: z
      .string()
      .refine((val) => isAddress(val), {
        message: 'Import permit recipient :: invalid address',
      })
      .refine((val) => is0xPrefixed(val), {
        message: 'Import permit recipient :: must be 0x prefixed',
      })
      .refine((val) => val !== zeroAddress, {
        message: 'Import permit recipient :: must not be zeroAddress',
      }),
    issuerSignature: z
      .string()
      .refine((val) => is0xPrefixed(val), {
        message: 'Import permit issuerSignature :: must be 0x prefixed',
      })
      .refine((val) => val !== '0x', {
        message: 'Import permit :: issuerSignature must be provided',
      }),
    name: z.string().optional().default('Unnamed Permit'),
    expiration: z.number().optional().default(DEFAULT_EXPIRATION_FN),
    validatorId: z.number().optional().default(0),
    validatorContract: z
      .string()
      .optional()
      .default(zeroAddress)
      .refine((val) => isAddress(val), {
        message: 'Import permit validatorContract :: invalid address',
      }),
    recipientSignature: z
      .string()
      .optional()
      .default('0x')
      .refine((val) => is0xPrefixed(val), {
        message: 'Import permit recipientSignature :: must be 0x prefixed',
      }),
  })
  .refine(...ValidatorContractRefinement);

/**
 * Validator for fully formed import/recipient permits
 */
export const ImportPermitValidator = zPermitWithSealingPair
  .refine((data) => data.type === 'recipient', {
    message: "Import permit :: type must be 'recipient'",
  })
  .refine((data) => data.recipient !== zeroAddress, {
    message: 'Import permit :: recipient must not be zeroAddress',
  })
  .refine((data) => data.issuerSignature !== '0x', {
    message: 'Import permit :: issuerSignature must be populated',
  })
  .refine((data) => data.recipientSignature !== '0x', {
    message: 'Import permit :: recipientSignature must be populated',
  })
  .refine(...ValidatorContractRefinement);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates self permit creation options
 */
export const validateSelfPermitOptions = (options: any) => SelfPermitOptionsValidator.safeParse(options);

/**
 * Validates sharing permit creation options
 */
export const validateSharingPermitOptions = (options: any) => SharingPermitOptionsValidator.safeParse(options);

/**
 * Validates import permit creation options
 */
export const validateImportPermitOptions = (options: any) => ImportPermitOptionsValidator.safeParse(options);

/**
 * Validates a fully formed self permit
 */
export const validateSelfPermit = (permit: any) => SelfPermitValidator.safeParse(permit);

/**
 * Validates a fully formed sharing permit
 */
export const validateSharingPermit = (permit: any) => SharingPermitValidator.safeParse(permit);

/**
 * Validates a fully formed import/recipient permit
 */
export const validateImportPermit = (permit: any) => ImportPermitValidator.safeParse(permit);

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
