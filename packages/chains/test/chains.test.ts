import { describe, it, expect } from 'vitest';
import { sepolia, arbSepolia, baseSepolia, hardhat, chains, getChainById, getChainByName } from '../src/index.js';

describe('Chains', () => {
  it('should export all chains', () => {
    expect(Object.keys(chains)).toHaveLength(4);
    expect(chains).toHaveProperty('sepolia');
    expect(chains).toHaveProperty('arbSepolia');
    expect(chains).toHaveProperty('baseSepolia');
    expect(chains).toHaveProperty('hardhat');
  });

  it('should have correct chain configurations', () => {
    expect(sepolia.id).toBe(11155111);
    expect(sepolia.name).toBe('Sepolia');
    expect(sepolia.environment).toBe('TESTNET');

    expect(hardhat.id).toBe(31337);
    expect(hardhat.name).toBe('Hardhat');
    expect(hardhat.environment).toBe('MOCK');
  });

  it('should find chains by ID', () => {
    expect(getChainById(11155111)).toBe(sepolia);
    expect(getChainById(31337)).toBe(hardhat);
    expect(getChainById(999999)).toBeUndefined();
  });

  it('should find chains by name', () => {
    expect(getChainByName('sepolia')).toBe(sepolia);
    expect(getChainByName('Sepolia')).toBe(sepolia);
    expect(getChainByName('hardhat')).toBe(hardhat);
    expect(getChainByName('nonexistent')).toBeUndefined();
  });

  it('should validate chain properties', () => {
    const allChains = [sepolia, arbSepolia, baseSepolia, hardhat];

    allChains.forEach((chain) => {
      expect(typeof chain.id).toBe('number');
      expect(typeof chain.name).toBe('string');
      expect(typeof chain.network).toBe('string');
      expect(typeof chain.coFheUrl).toBe('string');
      expect(typeof chain.verifierUrl).toBe('string');
      expect(typeof chain.thresholdNetworkUrl).toBe('string');
      expect(['MOCK', 'TESTNET', 'MAINNET']).toContain(chain.environment);
    });
  });
});
