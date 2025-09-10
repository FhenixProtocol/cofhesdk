import { CofheChainSchema, type CofheChain } from './types.js'

/**
 * Defines and validates a CofheChain configuration
 * @param chainConfig - The chain configuration object to validate
 * @returns The validated chain configuration unchanged
 * @throws {Error} If the chain configuration is invalid
 */
export function defineChain(chainConfig: CofheChain): CofheChain {
	const result = CofheChainSchema.safeParse(chainConfig)

	if (!result.success) {
		const errorMessages = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`)
		throw new Error(`Invalid chain configuration: ${errorMessages.join(', ')}`)
	}

	return result.data
}
