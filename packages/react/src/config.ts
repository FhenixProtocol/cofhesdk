import { z } from 'zod';
import { type CofhesdkConfig, type CofhesdkInputConfig } from '@cofhe/sdk';
import { createCofhesdkConfig as createCofhesdkConfigWeb } from '@cofhe/sdk/web';
import { getAddress, isAddress, zeroAddress } from 'viem';

/**
 * Zod schema for react configuration validation
 */

export const addressSchema = z
  .string()
  .refine((val) => isAddress(val), {
    error: 'Invalid address',
  })
  .refine((val) => val !== zeroAddress, {
    error: 'Must not be zeroAddress',
  })
  .transform((val) => getAddress(val));

export const CofhesdkReactConfigSchema = z.object({
  shareablePermits: z.boolean().optional().default(false),
  enableShieldUnshield: z.boolean().optional().default(true),
  autogeneratePermits: z.boolean().optional().default(true),
  permitExpirationOptions: z
    .array(
      z.object({
        label: z.string(),
        intervalSeconds: z.number().min(0),
      })
    )
    .optional()
    .default([
      { label: '1 Day', intervalSeconds: 86400 },
      { label: '1 Week', intervalSeconds: 604800 },
      { label: '1 Month', intervalSeconds: 2592000 },
    ]),
  defaultPermitExpirationSeconds: z.number().optional().default(604800), // 1 week
  pinnedTokens: z.record(z.string(), addressSchema).optional().default({
    11155111: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A', // sepolia weth
    84532: '0xbED96aa98a49FeA71fcC55d755b915cF022a9159', // base sepolia weth
    // 421613: '0x980b62da83eff3d4576c647993b0c1d7faf17c73', // arbitrum sepolia weth
  }),
  tokenLists: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .default({
      11155111: ['https://storage.googleapis.com/cofhesdk/sepolia.json'],
      84532: ['https://storage.googleapis.com/cofhesdk/base-sepolia.json'],
      // 421613: ['https://tokens.cofhe.io/arbitrum-sepolia.json'],
    })
    .transform((lists) => lists as Partial<Record<number, string[]>>),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional().default('bottom-right'),
  initialTheme: z.enum(['dark', 'light']).optional().default('light'),
});

/**
 * Input config type inferred from the schema
 */
export type CofhesdkReactInputConfig = CofhesdkInputConfig & {
  react?: z.input<typeof CofhesdkReactConfigSchema>;
};

export type CofhesdkConfigWithReact = CofhesdkConfig & {
  react: z.output<typeof CofhesdkReactConfigSchema>;
};
/**
 * Creates a CoFHE SDK client plus React react configuration with reasonable defaults.
 * @param config - Cofhesdk client input merged with a `react` object (fheKeyStorage defaults to IndexedDB when omitted).
 * @returns The combined client configuration with a validated `react` section and Web defaults applied.
 */
export function createCofhesdkConfig(config: CofhesdkReactInputConfig): CofhesdkConfigWithReact {
  const { react: reactConfigInput = {}, ...webConfig } = config;

  const webClientConfig = createCofhesdkConfigWeb({
    environment: 'react',
    ...webConfig,
  });
  const reactConfigResult = CofhesdkReactConfigSchema.safeParse(reactConfigInput);

  if (!reactConfigResult.success) {
    throw new Error(`Invalid cofhesdk react configuration: ${z.prettifyError(reactConfigResult.error)}`, {
      cause: reactConfigResult.error,
    });
  }

  return {
    ...webClientConfig,
    react: reactConfigResult.data,
  };
}
