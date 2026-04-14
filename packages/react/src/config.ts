import { z } from 'zod';
import { type CofheConfig, type CofheInputConfig } from '@cofhe/sdk';
import { createCofheConfig as createCofheConfigWeb } from '@cofhe/sdk/web';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { setReactLogger } from '@/utils/debug';

export type CofheReactLoggerMethod = ((...args: unknown[]) => void) | null;

/**
 * Logger used by @cofhe/react internal debug logs.
 *
 * - Omitted/undefined: disables internal logging
 * - Object: enables logging and calls only the provided methods
 * - Method set to null: disables that method
 */
export type CofheReactLogger = {
  log?: CofheReactLoggerMethod;
  warn?: CofheReactLoggerMethod;
  debug?: CofheReactLoggerMethod;
  error?: CofheReactLoggerMethod;
};

export type CofheReactLoggerResolved = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const noopCofheReactLoggerMethod = (..._args: unknown[]) => {};

export const NOOP_COFHE_REACT_LOGGER: CofheReactLoggerResolved = {
  log: noopCofheReactLoggerMethod,
  warn: noopCofheReactLoggerMethod,
  debug: noopCofheReactLoggerMethod,
  error: noopCofheReactLoggerMethod,
};

function resolveLoggerMethod(method: unknown): (...args: unknown[]) => void {
  return typeof method === 'function' ? (method as (...args: unknown[]) => void) : noopCofheReactLoggerMethod;
}

export function resolveCofheReactLogger(logger: unknown): CofheReactLoggerResolved {
  if (logger === null || logger === undefined) return NOOP_COFHE_REACT_LOGGER;
  if (typeof logger !== 'object') return NOOP_COFHE_REACT_LOGGER;

  const obj = logger as Record<string, unknown>;
  return {
    log: resolveLoggerMethod(obj.log),
    warn: resolveLoggerMethod(obj.warn),
    debug: resolveLoggerMethod(obj.debug),
    error: resolveLoggerMethod(obj.error),
  };
}

const CofheReactLoggerSchema = z
  .custom<CofheReactLogger | null>((value) => value === null || (typeof value === 'object' && value !== null), {
    error: 'Invalid logger',
  })
  .optional()
  .default(null)
  .transform((value) => resolveCofheReactLogger(value));

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
  projectName: z.string().trim().optional().default(''),
  logger: CofheReactLoggerSchema,
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

  // Configure internal logger immediately (outside of React render lifecycle).
  setReactLogger(reactConfigResult.data.logger);

  return {
    ...webClientConfig,
    react: reactConfigResult.data,
  };
}
