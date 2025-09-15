import { z } from 'zod';

/**
 * Environment schema for cofhejs chains
 */
export const EnvironmentSchema = z.enum(['MOCK', 'TESTNET', 'MAINNET']);

/**
 * Zod schema for CofheChain validation
 */
export const CofheChainSchema = z.object({
  /** Chain ID */
  id: z.number().int().positive(),
  /** Human-readable chain name */
  name: z.string().min(1),
  /** Network identifier */
  network: z.string().min(1),
  /** coFhe service URL */
  coFheUrl: z.string().url(),
  /** Verifier service URL */
  verifierUrl: z.string().url(),
  /** Threshold network service URL */
  thresholdNetworkUrl: z.string().url(),
  /** Environment type */
  environment: EnvironmentSchema,
});

/**
 * Type inference from the schema
 */
export type CofheChain = z.infer<typeof CofheChainSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
