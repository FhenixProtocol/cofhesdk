import { z } from 'zod'
import { isAddress, zeroAddress } from 'viem'
import { Permit, PermitOptions, ValidationResult } from './types'

const SerializedSealingPair = z.object({
	privateKey: z.string(),
	publicKey: z.string(),
})

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
	expiration: z.number().optional().default(1000000000000),
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
})

const zPermitWithSealingPair = zPermitWithDefaults.extend({
	sealingPair: SerializedSealingPair.optional(),
})

type zPermitType = z.infer<typeof zPermitWithDefaults>

/**
 * Permits allow a hook into an optional external validator contract,
 * this check ensures that IF an external validator is applied, that both `validatorId` and `validatorContract` are populated,
 * ELSE ensures that both `validatorId` and `validatorContract` are empty
 */
const PermitRefineValidator = [
	(data: zPermitType) =>
		(data.validatorId !== 0 && data.validatorContract !== zeroAddress) || (data.validatorId === 0 && data.validatorContract === zeroAddress),
	{
		message: 'Permit external validator :: validatorId and validatorContract must either both be set or both be unset.',
		path: ['validatorId', 'validatorContract'] as string[],
	},
] as const

/**
 * SuperRefinement that checks a Permits signatures
 * checkRecipient - whether to validate that `recipient` is empty for permit with type <self>, and populated for <sharing | recipient>
 * checkSealingPair - only the fully formed permit requires the sealing pair, it can be optional for permit create params
 * checkExistingSignatures - not optional - checks that the permit's type matches the populated signature fields
 * checkSigned - checks that the active user's signature has been signed and added. <self | signed> -> issuerSignature, <recipient> -> recipientSignature
 */
const PermitSignaturesSuperRefinement = (options: { checkRecipient: boolean; checkSealingPair: boolean; checkSigned: boolean }) => {
	return (data: zPermitType, ctx: z.RefinementCtx) => {
		// Check Recipient
		//    If type <self | sharing>, `Permit.recipient` must be zeroAddress
		//    If type <recipient>, `Permit.recipient` must not be zeroAddress
		if (options.checkRecipient) {
			if (data.type === 'self' && data.recipient !== zeroAddress)
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['recipient'],
					message: `Permit (type '${data.type}') recipient :: must be empty (zeroAddress)`,
				})
			if ((data.type === 'recipient' || data.type === 'sharing') && data.recipient === zeroAddress) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['recipient'],
					message: `Permit (type '${data.type}') recipient :: must not be empty`,
				})
			}
		}

		// Check Sealing Pair
		if (options.checkSealingPair && 'sealingPair' in data && data.sealingPair == null)
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['sealingPair'],
				message: `Permit sealingPair :: must not be empty`,
			})

		// Check existing signatures match type (not checking this user's signature, but the other signature)
		//     If type <self | sharing>, `Permit.recipientSignature` must be empty
		//     If type <recipient>, `Permit.issuerSignature` must not be empty
		if ((data.type === 'self' || data.type === 'sharing') && data.recipientSignature !== '0x') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['recipientSignature'],
				message: `Permit (type '${data.type}') recipientSignature :: should not be populated by the issuer`,
			})
		}
		if (data.type === 'recipient' && data.issuerSignature === '0x') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['issuerSignature'],
				message: `Permit (type 'recipient') issuerSignature :: \`issuer\` must sign the Permit before sharing it with \`recipient\``,
			})
		}

		// Check Signed
		//     If type <self | sharing>, `Permit.issuerSignature` must not be empty
		//     If type <recipient>, `Permit.recipientSignature` must not be empty
		if (options.checkSigned) {
			if ((data.type === 'self' || data.type === 'sharing') && data.issuerSignature === '0x')
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['issuerSignature'],
					message: `Permit (type '${data.type}') issuerSignature :: must be populated with issuer's signature. Use \`PermitUtils.sign\` or create permit with \`PermitUtils.createAndSign\``,
				})
			if (data.type === 'recipient' && data.recipientSignature === '0x') {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['recipientSignature'],
					message: `Permit (type 'recipient') recipientSignature :: must be populated with recipient's signature. Use \`PermitUtils.sign\` or create permit with \`PermitUtils.createAndSign\``,
				})
			}
		}

		return
	}
}

/**
 * Validator for the params used when creating a fresh Permit
 * Has defaults added that will be populated in the options object
 * Signatures superRefinement checks only the recipient, sealingPair and signatures are not necessary in the Permit params
 */
export const PermitParamsValidator = zPermitWithDefaults.refine(...PermitRefineValidator).superRefine(
	PermitSignaturesSuperRefinement({
		checkRecipient: true,
		checkSealingPair: false, // SealingPair not required when creating a fresh permit
		checkSigned: false, // Signature not required when creating a fresh permit
	})
)

/**
 * Validator for a Permit that is expected to be fully formed
 * Does not allow optional values or offer defaults
 * Validates that the correct signatures are populated
 * Validates sealingPair is populated
 */
export const FullyFormedPermitValidator = zPermitWithSealingPair
	.required()
	.refine(...PermitRefineValidator)
	.superRefine(
		PermitSignaturesSuperRefinement({
			checkRecipient: true,
			checkSealingPair: true,
			checkSigned: true,
		})
	)

/**
 * Validates permit creation options
 */
export const validatePermitOptions = (options: PermitOptions): { success: boolean; data?: PermitOptions; error?: any } => {
	const result = PermitParamsValidator.safeParse(options)
	return {
		success: result.success,
		data: result.success ? result.data : undefined,
		error: result.success ? undefined : result.error,
	}
}

/**
 * Validates a fully formed permit
 */
export const validatePermit = (permit: Permit): { success: boolean; data?: Permit; error?: any } => {
	const result = FullyFormedPermitValidator.safeParse(permit)
	return {
		success: result.success,
		data: result.success ? permit : undefined,
		error: result.success ? undefined : result.error,
	}
}

/**
 * Simple validation functions for common checks
 */
export const ValidationUtils = {
	/**
	 * Check if permit is expired
	 */
	isExpired: (permit: Permit): boolean => {
		return permit.expiration < Math.floor(Date.now() / 1000)
	},

	/**
	 * Check if permit is signed by the active party
	 */
	isSigned: (permit: Permit): boolean => {
		if (permit.type === 'self' || permit.type === 'sharing') {
			return permit.issuerSignature !== '0x'
		}
		if (permit.type === 'recipient') {
			return permit.recipientSignature !== '0x'
		}
		return false
	},

	/**
	 * Overall validity checker of a permit
	 */
	isValid: (permit: Permit): ValidationResult => {
		if (ValidationUtils.isExpired(permit)) {
			return { valid: false, error: 'expired' }
		}
		if (!ValidationUtils.isSigned(permit)) {
			return { valid: false, error: 'not-signed' }
		}
		return { valid: true, error: null }
	},
}
