import { describe, it, expect } from 'vitest';
import { createCofhesdkConfig, CofhesdkConfig } from '../src/config.js';
import { sepolia, hardhat } from '@cofhesdk/chains';

describe('createCofhesdkConfig', () => {
  it('should create a valid config with supported chains', () => {
    const config: CofhesdkConfig = {
      supportedChains: [sepolia, hardhat],
    };

    const result = createCofhesdkConfig(config);

    expect(result).toEqual(config);
    expect(result.supportedChains).toHaveLength(2);
    expect(result.supportedChains).toContain(sepolia);
    expect(result.supportedChains).toContain(hardhat);
  });

  it('should create a valid config with empty supported chains array', () => {
    const config: CofhesdkConfig = {
      supportedChains: [],
    };

    const result = createCofhesdkConfig(config);

    expect(result).toEqual(config);
    expect(result.supportedChains).toHaveLength(0);
  });

  it('should create a valid config with single chain', () => {
    const config: CofhesdkConfig = {
      supportedChains: [sepolia],
    };

    const result = createCofhesdkConfig(config);

    expect(result).toEqual(config);
    expect(result.supportedChains).toHaveLength(1);
    expect(result.supportedChains[0]).toBe(sepolia);
  });

  it('should throw error for invalid config - missing supportedChains', () => {
    const invalidConfig = {} as CofhesdkConfig;

    expect(() => createCofhesdkConfig(invalidConfig)).toThrow('Invalid cofhesdk configuration:');
  });

  it('should throw error for invalid config - supportedChains not an array', () => {
    const invalidConfig = {
      supportedChains: 'not-an-array',
    } as unknown as CofhesdkConfig;

    expect(() => createCofhesdkConfig(invalidConfig)).toThrow('Invalid cofhesdk configuration:');
  });

  it('should throw error for invalid config - null supportedChains', () => {
    const invalidConfig = {
      supportedChains: null,
    } as unknown as CofhesdkConfig;

    expect(() => createCofhesdkConfig(invalidConfig)).toThrow('Invalid cofhesdk configuration:');
  });

  it('should throw error for invalid config - undefined supportedChains', () => {
    const invalidConfig = {
      supportedChains: undefined,
    } as unknown as CofhesdkConfig;

    expect(() => createCofhesdkConfig(invalidConfig)).toThrow('Invalid cofhesdk configuration:');
  });
});

