import { describe, it, expect } from 'vitest';
import { createCofhesdkConfig, CofhesdkConfig, getCofhesdkConfigItem, CofhesdkInputConfig } from './config.js';
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

  it('keyFetchingStrategy', () => {
    expectInvalidConfigItem('keyFetchingStrategy', 'invalid-option');
    expectInvalidConfigItem('keyFetchingStrategy', 5);

    expectValidConfigItem('keyFetchingStrategy', 'CONNECTED_CHAIN', 'CONNECTED_CHAIN');
    expectValidConfigItem('keyFetchingStrategy', 'SUPPORTED_CHAINS', 'SUPPORTED_CHAINS');
    expectValidConfigItem('keyFetchingStrategy', undefined, 'CONNECTED_CHAIN');
  });

  it('generatePermitDuringInitialization', () => {
    expectInvalidConfigItem('generatePermitDuringInitialization', 'not-a-boolean');
    expectInvalidConfigItem('generatePermitDuringInitialization', null);

    expectValidConfigItem('generatePermitDuringInitialization', true, true);
    expectValidConfigItem('generatePermitDuringInitialization', false, false);
    expectValidConfigItem('generatePermitDuringInitialization', undefined, false);
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
