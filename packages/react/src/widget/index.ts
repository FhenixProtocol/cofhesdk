import { z } from 'zod';
import { type CofhesdkConfig, type CofhesdkInputConfig } from '@cofhe/sdk';
import { createCofhesdkConfig as createCofhesdkConfigWeb } from '@cofhe/sdk/web';

/**
 * Zod schema for widget configuration validation
 */
export const CofhesdkWidgetConfigSchema = z.object({
  shareablePermits: z.boolean().optional().default(false),
  portalShieldUnshield: z.boolean().optional().default(true),
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
  pinnedTokens: z.record(z.number(), z.string()).optional().default({
    11155111: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9', // sepolia weth
    84531: '0x4200000000000000000000000000000000000006', // base sepolia weth
    421613: '0x980b62da83eff3d4576c647993b0c1d7faf17c73', // arbitrum sepolia weth
  }),
  tokenLists: z
    .record(z.number(), z.array(z.string()))
    .optional()
    .default({
      11155111: ['https://tokens.cofhe.io/sepolia.json'],
      84531: ['https://tokens.cofhe.io/base-sepolia.json'],
      421613: ['https://tokens.cofhe.io/arbitrum-sepolia.json'],
    }),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional().default('bottom-right'),
});

/**
 * Input config type inferred from the schema
 */
export type CofhesdkWidgetInputConfig = {
  client: CofhesdkInputConfig;
  widget: z.input<typeof CofhesdkWidgetConfigSchema>;
};

export type CofhesdkWidgetConfig = {
  client: CofhesdkConfig;
  widget: z.output<typeof CofhesdkWidgetConfigSchema>;
};
/**
 * Creates a CoFHE SDK Client and Widget configuration reasonable defaults
 * @param config - {widget, client} The CoFHE SDK Client and Widget input configurations (fheKeyStorage will default to IndexedDB if not provided)
 * @returns The CoFHE SDK Client and Widget configuration with Web defaults applied
 */
export function createCofhesdkConfig(config: CofhesdkWidgetInputConfig): CofhesdkWidgetConfig {
  const { widget: widgetConfigInput, client: webConfigInput } = config;

  const webClientConfig = createCofhesdkConfigWeb(webConfigInput);
  const widgetConfigResult = CofhesdkWidgetConfigSchema.safeParse(widgetConfigInput);

  if (!widgetConfigResult.success) {
    throw new Error(`Invalid cofhesdk widget configuration: ${widgetConfigResult.error.message}`);
  }

  return {
    client: webClientConfig,
    widget: widgetConfigResult.data,
  };
}
