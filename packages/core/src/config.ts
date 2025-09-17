import { z } from 'zod';
import type { CofheChain } from '@cofhesdk/chains';

/**
 * Zod schema for configuration validation
 */
export const CofhesdkConfigSchema = z.object({
  /** List of supported chain configurations */
  supportedChains: z.array(z.custom<CofheChain>()),
});

/**
 * Configuration type inferred from the schema
 */
export type CofhesdkConfig = z.infer<typeof CofhesdkConfigSchema>;

/**
 * Creates and validates a cofhesdk configuration
 * @param config - The configuration object to validate
 * @returns The validated configuration
 * @throws {Error} If the configuration is invalid
 */
export function createCofhesdkConfig(config: CofhesdkConfig): CofhesdkConfig {
  const result = CofhesdkConfigSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid cofhesdk configuration: ${result.error.message}`);
  }

  return result.data;
}
