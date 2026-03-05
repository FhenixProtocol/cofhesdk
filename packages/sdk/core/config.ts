import { type CofheChain } from '@/chains';

import { z } from 'zod';
import { type WalletClient } from 'viem';
import { CofheError, CofheErrorCode } from './error.js';
import { type IStorage } from './types.js';

export type CofheEnvironment = 'node' | 'hardhat' | 'web' | 'react';

/**
 * Usable config type inferred from the schema
 */
export type CofheConfig = {
  /** Environment that the SDK is running in */
  environment: 'node' | 'hardhat' | 'web' | 'react';
  /** List of supported chains */
  supportedChains: CofheChain[];
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
    decryptDelay: number;
    /**
     * Simulated delay(s) in milliseconds for each step of encryptInputs in mock mode.
     * A single number applies the same delay to all five steps (InitTfhe, FetchKeys, Pack, Prove, Verify).
     * A tuple of five numbers applies a per-step delay: [InitTfhe, FetchKeys, Pack, Prove, Verify].
     * Default: [100, 100, 100, 500, 500]
     */
    encryptDelay: number | [number, number, number, number, number];
  };
  _internal?: CofheInternalConfig;
};

export type CofheInternalConfig = {
  zkvWalletClient?: WalletClient;
};

/**
 * Zod schema for configuration validation
 */
export const CofheConfigSchema = z.object({
  /** Environment that the SDK is running in */
  environment: z.enum(['node', 'hardhat', 'web', 'react']).optional().default('node'),
  /** List of supported chain configurations */
  supportedChains: z.array(z.custom<CofheChain>()),
  /** Default permit expiration in seconds, default is 30 days */
  defaultPermitExpiration: z
    .number()
    .optional()
    .default(60 * 60 * 24 * 30),
  /** Storage method for fhe keys (defaults to indexedDB on web, filesystem on node) */
  fheKeyStorage: z
    .object({
      getItem: z.custom<IStorage['getItem']>((val) => typeof val === 'function', {
        message: 'getItem must be a function',
      }),
      setItem: z.custom<IStorage['setItem']>((val) => typeof val === 'function', {
        message: 'setItem must be a function',
      }),
      removeItem: z.custom<IStorage['removeItem']>((val) => typeof val === 'function', {
        message: 'removeItem must be a function',
      }),
    })
    .or(z.null())
    .default(null),
  /** Whether to use Web Workers for ZK proof generation (web platform only) */
  useWorkers: z.boolean().optional().default(true),
  /** Mocks configs */
  mocks: z
    .object({
      decryptDelay: z.number().optional().default(0),
      encryptDelay: z
        .union([z.number(), z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()])])
        .optional()
        .default([100, 100, 100, 500, 500]),
    })
    .optional()
    .default({ decryptDelay: 0, encryptDelay: [100, 100, 100, 500, 500] }),
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
export type CofheInputConfig = z.input<typeof CofheConfigSchema>;

/**
 * Creates and validates a cofhe configuration (base implementation)
 * @param config - The configuration object to validate
 * @returns The validated configuration
 * @throws {Error} If the configuration is invalid
 */
export function createCofheConfigBase(config: CofheInputConfig): CofheConfig {
  const result = CofheConfigSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid cofhe configuration: ${z.prettifyError(result.error)}`, { cause: result.error });
  }

  return result.data;
}

/**
 * Access the CofheConfig object directly by providing the key.
 * This is powerful when you use OnchainKit utilities outside of the React context.
 */
export const getCofheConfigItem = <K extends keyof CofheConfig>(config: CofheConfig, key: K): CofheConfig[K] => {
  return config[key];
};

/**
 * Gets a supported chain from config by chainId, throws if not found
 * @param config - The cofhe configuration
 * @param chainId - The chain ID to look up
 * @returns The supported chain configuration
 * @throws {CofheError} If the chain is not found in the config
 */
export function getSupportedChainOrThrow(config: CofheConfig, chainId: number): CofheChain {
  const supportedChain = config.supportedChains.find((chain) => chain.id === chainId);

  if (!supportedChain) {
    throw new CofheError({
      code: CofheErrorCode.UnsupportedChain,
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
 * @param config - The cofhe configuration
 * @param chainId - The chain ID to look up
 * @returns The CoFHE URL for the chain
 * @throws {CofheError} If the chain or URL is not found
 */
export function getCoFheUrlOrThrow(config: CofheConfig, chainId: number): string {
  const supportedChain = getSupportedChainOrThrow(config, chainId);
  const url = supportedChain.coFheUrl;

  if (!url) {
    throw new CofheError({
      code: CofheErrorCode.MissingConfig,
      message: `CoFHE URL is not configured for chain <${chainId}>`,
      hint: 'Ensure this chain config includes a coFheUrl property.',
      context: { chainId },
    });
  }

  return url;
}

/**
 * Gets the ZK verifier URL for a chain, throws if not found
 * @param config - The cofhe configuration
 * @param chainId - The chain ID to look up
 * @returns The ZK verifier URL for the chain
 * @throws {CofheError} If the chain or URL is not found
 */
export function getZkVerifierUrlOrThrow(config: CofheConfig, chainId: number): string {
  const supportedChain = getSupportedChainOrThrow(config, chainId);
  const url = supportedChain.verifierUrl;

  if (!url) {
    throw new CofheError({
      code: CofheErrorCode.ZkVerifierUrlUninitialized,
      message: `ZK verifier URL is not configured for chain <${chainId}>`,
      hint: 'Ensure this chain config includes a verifierUrl property.',
      context: { chainId },
    });
  }

  return url;
}

/**
 * Gets the threshold network URL for a chain, throws if not found
 * @param config - The cofhe configuration
 * @param chainId - The chain ID to look up
 * @returns The threshold network URL for the chain
 * @throws {CofheError} If the chain or URL is not found
 */
export function getThresholdNetworkUrlOrThrow(config: CofheConfig, chainId: number): string {
  const supportedChain = getSupportedChainOrThrow(config, chainId);
  const url = supportedChain.thresholdNetworkUrl;

  if (!url) {
    throw new CofheError({
      code: CofheErrorCode.ThresholdNetworkUrlUninitialized,
      message: `Threshold network URL is not configured for chain <${chainId}>`,
      hint: 'Ensure this chain config includes a thresholdNetworkUrl property.',
      context: { chainId },
    });
  }

  return url;
}
