import { type CofheChain } from '@/chains';

import { z } from 'zod';
import { type WalletClient } from 'viem';
import { CofhesdkError, CofhesdkErrorCode } from './error.js';
import { type IStorage } from './types.js';

/**
 * Usable config type inferred from the schema
 */
export type CofhesdkConfig = {
  supportedChains: CofheChain[];
  /**
   * How permits are generated
   * - ON_CONNECT: Generate a permit when client.connect() is called
   * - ON_DECRYPT_HANDLES: Generate a permit when client.decryptHandles() is called
   * - MANUAL: Generate a permit manually using client.generatePermit()
   */
  permitGeneration: 'ON_CONNECT' | 'ON_DECRYPT_HANDLES' | 'MANUAL';
  /** Default permit expiration in seconds, default is 30 days */
  defaultPermitExpiration: number;
  /**
   * Storage scheme for the fetched fhe keys
   * FHE keys are large, and caching prevents re-fetching them on each encryptInputs call
   * (defaults to indexedDB on web, filesystem on node)
   */
  fheKeyStorage: IStorage | null;
  /**
   * Whether to use Web Workers for ZK proof generation (web platform only)
   * When enabled, heavy WASM computation is offloaded to prevent UI freezing
   * Default: true
   */
  useWorkers: boolean;
  /** Mocks configs */
  mocks: {
    /**
     * Length of the simulated seal output delay in milliseconds
     * Default 1000ms on web
     * Default 0ms on hardhat (will be called during tests no need for fake delay)
     */
    sealOutputDelay: number;
  };
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
  /** How permits are generated */
  permitGeneration: z.enum(['ON_CONNECT', 'ON_DECRYPT_HANDLES', 'MANUAL']).optional().default('ON_CONNECT'),
  /** Default permit expiration in seconds, default is 30 days */
  defaultPermitExpiration: z
    .number()
    .optional()
    .default(60 * 60 * 24 * 30),
  /** Storage method for fhe keys (defaults to indexedDB on web, filesystem on node) */
  fheKeyStorage: z
    .object({
      getItem: z.function().args(z.string()).returns(z.promise(z.any())),
      setItem: z.function().args(z.string(), z.any()).returns(z.promise(z.void())),
      removeItem: z.function().args(z.string()).returns(z.promise(z.void())),
    })
    .or(z.null())
    .default(null),
  /** Whether to use Web Workers for ZK proof generation (web platform only) */
  useWorkers: z.boolean().optional().default(true),
  /** Mocks configs */
  mocks: z
    .object({
      sealOutputDelay: z.number().optional().default(0),
    })
    .optional()
    .default({ sealOutputDelay: 0 }),
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
 * Creates and validates a cofhesdk configuration (base implementation)
 * @param config - The configuration object to validate
 * @returns The validated configuration
 * @throws {Error} If the configuration is invalid
 */
export function createCofhesdkConfigBase(config: CofhesdkInputConfig): CofhesdkConfig {
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

/**
 * Gets a supported chain from config by chainId, throws if not found
 * @param config - The cofhesdk configuration
 * @param chainId - The chain ID to look up
 * @returns The supported chain configuration
 * @throws {CofhesdkError} If the chain is not found in the config
 */
export function getSupportedChainOrThrow(config: CofhesdkConfig, chainId: number): CofheChain {
  const supportedChain = config.supportedChains.find((chain) => chain.id === chainId);

  if (!supportedChain) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.UnsupportedChain,
      message: `Config does not support chain <${chainId}>`,
      hint: 'Ensure config passed to client has been created with this chain in the config.supportedChains array.',
      context: {
        chainId,
        supportedChainIds: config.supportedChains.map((c) => c.id),
      },
    });
  }

  return supportedChain;
}

/**
 * Gets the CoFHE URL for a chain, throws if not found
 * @param config - The cofhesdk configuration
 * @param chainId - The chain ID to look up
 * @returns The CoFHE URL for the chain
 * @throws {CofhesdkError} If the chain or URL is not found
 */
export function getCoFheUrlOrThrow(config: CofhesdkConfig, chainId: number): string {
  const supportedChain = getSupportedChainOrThrow(config, chainId);
  const url = supportedChain.coFheUrl;

  if (!url) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.MissingConfig,
      message: `CoFHE URL is not configured for chain <${chainId}>`,
      hint: 'Ensure this chain config includes a coFheUrl property.',
      context: { chainId },
    });
  }

  return url;
}

/**
 * Gets the ZK verifier URL for a chain, throws if not found
 * @param config - The cofhesdk configuration
 * @param chainId - The chain ID to look up
 * @returns The ZK verifier URL for the chain
 * @throws {CofhesdkError} If the chain or URL is not found
 */
export function getZkVerifierUrlOrThrow(config: CofhesdkConfig, chainId: number): string {
  const supportedChain = getSupportedChainOrThrow(config, chainId);
  const url = supportedChain.verifierUrl;

  if (!url) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ZkVerifierUrlUninitialized,
      message: `ZK verifier URL is not configured for chain <${chainId}>`,
      hint: 'Ensure this chain config includes a verifierUrl property.',
      context: { chainId },
    });
  }

  return url;
}

/**
 * Gets the threshold network URL for a chain, throws if not found
 * @param config - The cofhesdk configuration
 * @param chainId - The chain ID to look up
 * @returns The threshold network URL for the chain
 * @throws {CofhesdkError} If the chain or URL is not found
 */
export function getThresholdNetworkUrlOrThrow(config: CofhesdkConfig, chainId: number): string {
  const supportedChain = getSupportedChainOrThrow(config, chainId);
  const url = supportedChain.thresholdNetworkUrl;

  if (!url) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.ThresholdNetworkUrlUninitialized,
      message: `Threshold network URL is not configured for chain <${chainId}>`,
      hint: 'Ensure this chain config includes a thresholdNetworkUrl property.',
      context: { chainId },
    });
  }

  return url;
}
