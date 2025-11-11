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
  pinnedTokens: z.record(z.number(), z.string()).optional().default({}),
  //TODO:  tokenList:
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
  widget: z.input<typeof CofhesdkWidgetConfigSchema>;
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
