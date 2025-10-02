import { z } from 'zod';
import { CofheChain } from '@cofhesdk/chains';
import { WalletClient } from 'viem';

/**
 * Usable config type inferred from the schema
 */
export type CofhesdkConfig = {
  supportedChains: CofheChain[];
  /**
   * Strategy for fetching FHE keys
   * - CONNECTED_CHAIN: Fetch keys for the connected chain (provided by the publicClient)
   * - SUPPORTED_CHAINS: Fetch keys for all supported chains (provided by the supportedChains config)
   * - OFF: Do not fetch keys (fetching occurs during encryptInputs)
   * */
  fheKeysPrefetching: 'CONNECTED_CHAIN' | 'SUPPORTED_CHAINS' | 'OFF';
  generatePermitDuringInitialization: boolean;
  _internal?: CofhesdkInternalConfig;
};

export type CofhesdkInternalConfig = {
  zkvWalletClient?: WalletClient;
};

/**
 * Zod schema for configuration validation
 */
export const CofhesdkConfigSchema = z.object({
  /** List of supported chain configurations */
  supportedChains: z.array(z.custom<CofheChain>()),
  /** Strategy for fetching FHE keys */
  fheKeysPrefetching: z.enum(['CONNECTED_CHAIN', 'SUPPORTED_CHAINS', 'OFF']).optional().default('OFF'),
  /** Whether to generate a permit during initialization */
  generatePermitDuringInitialization: z.boolean().optional().default(false),
  /** Internal configuration */
  _internal: z
    .object({
      zkvWalletClient: z.any().optional(),
    })
    .optional(),
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
