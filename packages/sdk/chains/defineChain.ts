import { CofheChainSchema, type CofheChain } from './types.js';
import { z } from 'zod';

/**
 * Defines and validates a CofheChain configuration
 * @param chainConfig - The chain configuration object to validate
 * @returns The validated chain configuration unchanged
 * @throws {Error} If the chain configuration is invalid
 */
export function defineChain(chainConfig: CofheChain): CofheChain {
  const result = CofheChainSchema.safeParse(chainConfig);

  if (!result.success) {
    throw new Error(`Invalid chain configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
