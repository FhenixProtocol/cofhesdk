import { sepolia, hardhat } from '@/chains';

import { describe, it, expect, vi } from 'vitest';
import {
  createCofheConfigBase,
  getCofheConfigItem,
  type CofheInputConfig,
  getSupportedChainOrThrow,
  getCoFheUrlOrThrow,
  getZkVerifierUrlOrThrow,
  getThresholdNetworkUrlOrThrow,
} from './config.js';

describe('createCofheConfigBase', () => {
  const validBaseConfig: CofheInputConfig = {
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
        createCofheConfigBase(config as CofheInputConfig);
      } catch (e) {
        console.log('expect config invalid', path, value, config, e);
      }
    }
    expect(() => createCofheConfigBase(config as CofheInputConfig)).toThrow('Invalid cofhe configuration:');
  };

  const expectValidConfigItem = (path: string, value: any, expectedValue: any): void => {
    const config = { ...validBaseConfig };
    setNestedValue(config, path, value);
    const result = createCofheConfigBase(config);
    expect(getNestedValue(result, path)).toEqual(expectedValue);
  };

  it('environment', () => {
    expectInvalidConfigItem('environment', 'not-a-valid-environment');
    expectInvalidConfigItem('environment', 123);
    expectInvalidConfigItem('environment', {});

    expectValidConfigItem('environment', 'node', 'node');
    expectValidConfigItem('environment', 'hardhat', 'hardhat');
    expectValidConfigItem('environment', 'web', 'web');
    expectValidConfigItem('environment', 'react', 'react');
  });

  it('supportedChains', () => {
    expectInvalidConfigItem('supportedChains', {});
    expectInvalidConfigItem('supportedChains', 'not-an-array');
    expectInvalidConfigItem('supportedChains', null);
    expectInvalidConfigItem('supportedChains', undefined);

    expectValidConfigItem('supportedChains', [sepolia], [sepolia]);
    expectValidConfigItem('supportedChains', [sepolia, hardhat], [sepolia, hardhat]);
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
    const result = createCofheConfigBase(config);

    expect(result.fheKeyStorage).not.toBeNull();
    await result.fheKeyStorage!.getItem('test');
    await result.fheKeyStorage!.setItem('test', 'test');
    await result.fheKeyStorage!.removeItem('test');

    expect(getItemCalled).toBe(true);
    expect(setItemCalled).toBe(true);
    expect(removeItemCalled).toBe(true);

    const invalidStorageNotAFunction = {
      getItem: 'not-a-function',
      setItem: 'not-a-function',
      removeItem: 'not-a-function',
    };

    expectInvalidConfigItem('fheKeyStorage', invalidStorageNotAFunction);
  });

  it('mocks', () => {
    expectInvalidConfigItem('mocks', 'not-an-object');
    expectInvalidConfigItem('mocks', null);
  });

  it('mocks.decryptDelay', () => {
    expectInvalidConfigItem('mocks.decryptDelay', 'not-a-number');
    expectInvalidConfigItem('mocks.decryptDelay', null);

    expectValidConfigItem('mocks.decryptDelay', undefined, 0);
    expectValidConfigItem('mocks.decryptDelay', 1000, 1000);
  });

  it('mocks.encryptDelay', () => {
    expectInvalidConfigItem('mocks.encryptDelay', 'not-a-number');
    expectInvalidConfigItem('mocks.encryptDelay', null);
    expectInvalidConfigItem('mocks.encryptDelay', [100, 100, 100]); // wrong tuple length
    expectInvalidConfigItem('mocks.encryptDelay', ['a', 'b', 'c', 'd', 'e']); // non-number elements

    expectValidConfigItem('mocks.encryptDelay', undefined, [100, 100, 100, 500, 500]);
    expectValidConfigItem('mocks.encryptDelay', 200, 200);
    expectValidConfigItem('mocks.encryptDelay', 0, 0);
    expectValidConfigItem('mocks.encryptDelay', [10, 20, 30, 40, 50], [10, 20, 30, 40, 50]);
  });

  it('useWorkers', () => {
    expectInvalidConfigItem('useWorkers', 'not-a-boolean');
    expectInvalidConfigItem('useWorkers', null);
    expectInvalidConfigItem('useWorkers', 123);
    expectInvalidConfigItem('useWorkers', {});

    expectValidConfigItem('useWorkers', true, true);
    expectValidConfigItem('useWorkers', false, false);
    expectValidConfigItem('useWorkers', undefined, true); // defaults to true
  });

  it('should get config item', () => {
    const config: CofheInputConfig = {
      supportedChains: [sepolia],
    };

    const result = createCofheConfigBase(config);

    const supportedChains = getCofheConfigItem(result, 'supportedChains');
    expect(supportedChains).toEqual(config.supportedChains);
  });
});

describe('Config helper functions', () => {
  const config = createCofheConfigBase({
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
      const configWithoutUrl = createCofheConfigBase({
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
      const configWithoutUrl = createCofheConfigBase({
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
      const configWithoutUrl = createCofheConfigBase({
        supportedChains: [{ ...sepolia, thresholdNetworkUrl: undefined } as any],
      });
      expect(() => getThresholdNetworkUrlOrThrow(configWithoutUrl, sepolia.id)).toThrow();
    });
  });
});
