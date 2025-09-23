import { z } from 'zod';
import type { CofheChain } from '@cofhesdk/chains';

/**
 * Usable config type inferred from the schema
 */
export type CofhesdkConfig = {
  supportedChains: CofheChain[];
  keyFetchingStrategy: 'CONNECTED_CHAIN' | 'SUPPORTED_CHAINS';
  generatePermitDuringInitialization: boolean;
};

/**
 * Zod schema for configuration validation
 */
export const CofhesdkConfigSchema = z.object({
  /** List of supported chain configurations */
  supportedChains: z.array(z.custom<CofheChain>()),
  /** Strategy for fetching FHE keys */
  keyFetchingStrategy: z.enum(['CONNECTED_CHAIN', 'SUPPORTED_CHAINS']).optional().default('SUPPORTED_CHAINS'),
  /** Whether to generate a permit during initialization */
  generatePermitDuringInitialization: z.boolean().optional().default(false),
});

/**
 * Input config type inferred from the schema
 */
export type CofhesdkInputConfig = z.input<typeof CofhesdkConfigSchema>;

/**
 * Creates and validates a cofhesdk configuration
 * @param config - The configuration object to validate
 * @returns The validated configuration
 * @throws {Error} If the configuration is invalid
 */
export function createCofhesdkConfig(config: CofhesdkInputConfig): CofhesdkConfig {
  const result = CofhesdkConfigSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid cofhesdk configuration: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Access the CofhesdkConfig object directly by providing the key.
 * This is powerful when you use OnchainKit utilities outside of the React context.
 */
export const getCofhesdkConfigItem = <K extends keyof CofhesdkConfig>(
  config: CofhesdkConfig,
  key: K
): CofhesdkConfig[K] => {
  return config[key];
};
