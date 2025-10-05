import { describe, it, expect } from 'vitest';
import {
  createCofhesdkConfig,
  CofhesdkConfig,
  getCofhesdkConfigItem,
  CofhesdkInputConfig,
  getSupportedChainOrThrow,
  getCoFheUrlOrThrow,
  getZkVerifierUrlOrThrow,
  getThresholdNetworkUrlOrThrow,
} from './config.js';
import { sepolia, hardhat } from '@cofhesdk/chains';

describe('createCofhesdkConfig', () => {
  const validBaseConfig: CofhesdkInputConfig = {
    supportedChains: [],
  };

  const expectInvalidConfigItem = (item: keyof CofhesdkConfig, value: any) => {
    const config = { ...validBaseConfig, [item]: value };
    expect(() => createCofhesdkConfig(config as CofhesdkInputConfig)).toThrow('Invalid cofhesdk configuration:');
  };
  const expectValidConfigItem = (item: keyof CofhesdkConfig, value: any, expectedValue: any) => {
    const config = { ...validBaseConfig, [item]: value };
    const result = createCofhesdkConfig(config);
    expect(result[item]).toEqual(expectedValue);
  };

  it('supportedChains', () => {
    expectInvalidConfigItem('supportedChains', {});
    expectInvalidConfigItem('supportedChains', 'not-an-array');
    expectInvalidConfigItem('supportedChains', null);
    expectInvalidConfigItem('supportedChains', undefined);

    expectValidConfigItem('supportedChains', [sepolia], [sepolia]);
    expectValidConfigItem('supportedChains', [sepolia, hardhat], [sepolia, hardhat]);
  });

  it('fheKeysPrefetching', () => {
    expectInvalidConfigItem('fheKeysPrefetching', 'invalid-option');
    expectInvalidConfigItem('fheKeysPrefetching', 5);

    expectValidConfigItem('fheKeysPrefetching', 'CONNECTED_CHAIN', 'CONNECTED_CHAIN');
    expectValidConfigItem('fheKeysPrefetching', 'SUPPORTED_CHAINS', 'SUPPORTED_CHAINS');
    expectValidConfigItem('fheKeysPrefetching', 'OFF', 'OFF');
    expectValidConfigItem('fheKeysPrefetching', undefined, 'OFF');
  });

  it('permitGeneration', () => {
    expectInvalidConfigItem('permitGeneration', 'not-a-boolean');
    expectInvalidConfigItem('permitGeneration', null);

    expectValidConfigItem('permitGeneration', 'ON_CONNECT', 'ON_CONNECT');
    expectValidConfigItem('permitGeneration', 'ON_DECRYPT_HANDLES', 'ON_DECRYPT_HANDLES');
    expectValidConfigItem('permitGeneration', 'MANUAL', 'MANUAL');
    expectValidConfigItem('permitGeneration', undefined, 'ON_CONNECT');
  });

  it('defaultPermitExpiration', () => {
    expectInvalidConfigItem('defaultPermitExpiration', 'not-a-number');
    expectInvalidConfigItem('defaultPermitExpiration', null);

    expectValidConfigItem('defaultPermitExpiration', 5, 5);
    expectValidConfigItem('defaultPermitExpiration', undefined, 60 * 60 * 24 * 30);
  });

  it('should get config item', () => {
    const config: CofhesdkInputConfig = {
      supportedChains: [sepolia],
    };

    const result = createCofhesdkConfig(config);

    const supportedChains = getCofhesdkConfigItem(result, 'supportedChains');
    expect(supportedChains).toEqual(config.supportedChains);
  });
});

describe('Config helper functions', () => {
  const config = createCofhesdkConfig({
    supportedChains: [sepolia, hardhat],
  });

  describe('getSupportedChainOrThrow', () => {
    it('should return chain when found', () => {
      expect(getSupportedChainOrThrow(config, sepolia.id)).toEqual(sepolia);
    });

    it('should throw UnsupportedChain error when not found', () => {
      expect(() => getSupportedChainOrThrow(config, 999999)).toThrow();
    });
  });

  describe('getCoFheUrlOrThrow', () => {
    it('should return coFheUrl', () => {
      expect(getCoFheUrlOrThrow(config, sepolia.id)).toBe(sepolia.coFheUrl);
    });

    it('should throw when chain not found', () => {
      expect(() => getCoFheUrlOrThrow(config, 999999)).toThrow();
    });

    it('should throw MissingConfig when url not set', () => {
      const configWithoutUrl = createCofhesdkConfig({
        supportedChains: [{ ...sepolia, coFheUrl: undefined } as any],
      });
      expect(() => getCoFheUrlOrThrow(configWithoutUrl, sepolia.id)).toThrow();
    });
  });

  describe('getZkVerifierUrlOrThrow', () => {
    it('should return verifierUrl', () => {
      expect(getZkVerifierUrlOrThrow(config, sepolia.id)).toBe(sepolia.verifierUrl);
    });

    it('should throw when chain not found', () => {
      expect(() => getZkVerifierUrlOrThrow(config, 999999)).toThrow();
    });

    it('should throw ZkVerifierUrlUninitialized when url not set', () => {
      const configWithoutUrl = createCofhesdkConfig({
        supportedChains: [{ ...sepolia, verifierUrl: undefined } as any],
      });
      expect(() => getZkVerifierUrlOrThrow(configWithoutUrl, sepolia.id)).toThrow();
    });
  });

  describe('getThresholdNetworkUrlOrThrow', () => {
    it('should return thresholdNetworkUrl', () => {
      expect(getThresholdNetworkUrlOrThrow(config, sepolia.id)).toBe(sepolia.thresholdNetworkUrl);
    });

    it('should throw when chain not found', () => {
      expect(() => getThresholdNetworkUrlOrThrow(config, 999999)).toThrow();
    });

    it('should throw ThresholdNetworkUrlUninitialized when url not set', () => {
      const configWithoutUrl = createCofhesdkConfig({
        supportedChains: [{ ...sepolia, thresholdNetworkUrl: undefined } as any],
      });
      expect(() => getThresholdNetworkUrlOrThrow(configWithoutUrl, sepolia.id)).toThrow();
    });
  });
});
