/* eslint-disable no-unused-vars */
import { sepolia, hardhat } from '@/chains';

import { describe, it, expect, vi } from 'vitest';
import {
  createCofhesdkConfigBase,
  getCofhesdkConfigItem,
  type CofhesdkInputConfig,
  getSupportedChainOrThrow,
  getCoFheUrlOrThrow,
  getZkVerifierUrlOrThrow,
  getThresholdNetworkUrlOrThrow,
} from './config.js';

describe('createCofhesdkConfigBase', () => {
  const validBaseConfig: CofhesdkInputConfig = {
    supportedChains: [],
  };

  const setNestedValue = (obj: any, path: string, value: any): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[lastKey] = value;
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  };

  const expectInvalidConfigItem = (path: string, value: any, log = false): void => {
    const config = { ...validBaseConfig };
    setNestedValue(config, path, value);
    if (log) {
      console.log('expect config invalid', path, value, config);
      try {
        createCofhesdkConfigBase(config as CofhesdkInputConfig);
      } catch (e) {
        console.log('expect config invalid', path, value, config, e);
      }
    }
    expect(() => createCofhesdkConfigBase(config as CofhesdkInputConfig)).toThrow('Invalid cofhesdk configuration:');
  };

  const expectValidConfigItem = (path: string, value: any, expectedValue: any): void => {
    const config = { ...validBaseConfig };
    setNestedValue(config, path, value);
    const result = createCofhesdkConfigBase(config);
    expect(getNestedValue(result, path)).toEqual(expectedValue);
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

  it('fheKeyStorage', async () => {
    expectInvalidConfigItem('fheKeyStorage', 'not-an-object');

    expectValidConfigItem('fheKeyStorage', undefined, null);
    expectValidConfigItem('fheKeyStorage', null, null);

    let getItemCalled = false;
    let setItemCalled = false;
    let removeItemCalled = false;

    const fakeStorage = {
      getItem: (name: string) => {
        getItemCalled = true;
        return Promise.resolve(null);
      },
      setItem: (name: string, value: any) => {
        setItemCalled = true;
        return Promise.resolve();
      },
      removeItem: (name: string) => {
        removeItemCalled = true;
        return Promise.resolve();
      },
    };

    const config = { ...validBaseConfig, fheKeyStorage: fakeStorage };
    const result = createCofhesdkConfigBase(config);

    expect(result.fheKeyStorage).not.toBeNull();
    await result.fheKeyStorage!.getItem('test');
    await result.fheKeyStorage!.setItem('test', 'test');
    await result.fheKeyStorage!.removeItem('test');

    expect(getItemCalled).toBe(true);
    expect(setItemCalled).toBe(true);
    expect(removeItemCalled).toBe(true);
  });

  it('mocks', () => {
    expectInvalidConfigItem('mocks', 'not-an-object');
    expectInvalidConfigItem('mocks', null);

    expectValidConfigItem('mocks', { sealOutputDelay: 1000 }, { sealOutputDelay: 1000 });
    expectValidConfigItem('mocks', undefined, { sealOutputDelay: 0 });
  });

  it('mocks.sealOutputDelay', () => {
    expectInvalidConfigItem('mocks.sealOutputDelay', 'not-a-number');
    expectInvalidConfigItem('mocks.sealOutputDelay', null);

    expectValidConfigItem('mocks.sealOutputDelay', undefined, 0);
    expectValidConfigItem('mocks.sealOutputDelay', 1000, 1000);
  });

  it('should get config item', () => {
    const config: CofhesdkInputConfig = {
      supportedChains: [sepolia],
    };

    const result = createCofhesdkConfigBase(config);

    const supportedChains = getCofhesdkConfigItem(result, 'supportedChains');
    expect(supportedChains).toEqual(config.supportedChains);
  });
});

describe('Config helper functions', () => {
  const config = createCofhesdkConfigBase({
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
      const configWithoutUrl = createCofhesdkConfigBase({
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
      const configWithoutUrl = createCofhesdkConfigBase({
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
      const configWithoutUrl = createCofhesdkConfigBase({
        supportedChains: [{ ...sepolia, thresholdNetworkUrl: undefined } as any],
      });
      expect(() => getThresholdNetworkUrlOrThrow(configWithoutUrl, sepolia.id)).toThrow();
    });
  });
});
