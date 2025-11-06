import { z } from 'zod';
import { type CofhesdkConfig, type CofhesdkInputConfig } from '@cofhe/sdk';
import { createCofhesdkConfig as createCofhesdkConfigWeb } from '@cofhe/sdk/web';
type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Zod schema for widget configuration validation
 */
export const CofhesdkWidgetConfigSchema = z.object({
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
  widget: {
    position: WidgetPosition;
  };
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
