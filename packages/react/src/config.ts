import { z } from 'zod';
import { type CofheConfig, type CofheInputConfig } from '@cofhe/sdk';
import { createCofheConfig as createCofheConfigWeb } from '@cofhe/sdk/web';
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

export const CofheReactConfigSchema = z.object({
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
  pinnedTokens: z.record(z.string(), addressSchema).optional(),
  tokenLists: z
    .record(z.string(), z.array(z.string()))
    .transform((lists) => lists as Partial<Record<number, string[]>>)
    .optional(),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional().default('bottom-right'),
  initialTheme: z.enum(['dark', 'light']).optional().default('light'),
});

/**
 * Input config type inferred from the schema
 */
export type CofheReactInputConfig = CofheInputConfig & {
  react?: z.input<typeof CofheReactConfigSchema>;
};

export type CofheConfigWithReact = CofheConfig & {
  react: z.output<typeof CofheReactConfigSchema>;
};
/**
 * Creates a CoFHE client plus React configuration with reasonable defaults.
 * @param config - Cofhe client input merged with a `react` object (fheKeyStorage defaults to IndexedDB when omitted).
 * @returns The combined client configuration with a validated `react` section and Web defaults applied.
 */
export function createCofheConfig(config: CofheReactInputConfig): CofheConfigWithReact {
  const { react: reactConfigInput = {}, ...webConfig } = config;

  const webClientConfig = createCofheConfigWeb({
    environment: 'react',
    ...webConfig,
  });
  const reactConfigResult = CofheReactConfigSchema.safeParse(reactConfigInput);

  if (!reactConfigResult.success) {
    throw new Error(`Invalid cofhe react configuration: ${z.prettifyError(reactConfigResult.error)}`, {
      cause: reactConfigResult.error,
    });
  }

  return {
    ...webClientConfig,
    react: reactConfigResult.data,
  };
}
