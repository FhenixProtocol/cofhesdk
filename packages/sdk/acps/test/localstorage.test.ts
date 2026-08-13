/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getACP, setACP, removeACP, getActiveACPHash, setActiveACPHash, ACPUtils, acpStore } from '../index.js';
import { createMockACP } from '../test-utils.js';

// Type declarations for happy-dom environment
declare const localStorage: {
  clear: () => void;
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
};

describe('ACPs localStorage Tests', () => {
  const chainId = 1;
  const account = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    // Clear localStorage and reset store state
    localStorage.clear();
    acpStore.resetStore();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    acpStore.resetStore();
  });

  it('should persist acps to localStorage', async () => {
    const acp = await createMockACP();

    setACP(chainId, account, acp);

    // Verify data is stored in localStorage
    const storedData = localStorage.getItem('cofhesdk-acps');
    expect(storedData).toBeDefined();

    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.acps[chainId][account][acp.hash]).toBeDefined();
  });

  it('should persist active acp hash to localStorage', async () => {
    const acp = await createMockACP();

    setACP(chainId, account, acp);
    setActiveACPHash(chainId, account, acp.hash);

    // Verify active acp hash is stored
    const storedData = localStorage.getItem('cofhesdk-acps');
    expect(storedData).toBeDefined();

    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.activeACPHash[chainId][account]).toBe(acp.hash);
  });

  it('should restore acps from localStorage', async () => {
    const acp = await createMockACP();

    // Add acp to localStorage
    setACP(chainId, account, acp);
    setActiveACPHash(chainId, account, acp.hash);
    const serializedACP = ACPUtils.serialize(acp);

    // Verify data is restored
    const retrievedACP = getACP(chainId, account, acp.hash);
    expect(retrievedACP).toBeDefined();
    expect(ACPUtils.serialize(retrievedACP!)).toEqual(serializedACP);

    const activeHash = getActiveACPHash(chainId, account);
    expect(activeHash).toBe(acp.hash);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('cofhesdk-acps', 'invalid json');

    // Store should handle this gracefully
    expect(() => {
      acpStore.store.getState();
    }).not.toThrow();
  });

  it('should clean up localStorage when acps are removed', async () => {
    const acp = await createMockACP();

    setACP(chainId, account, acp);
    setActiveACPHash(chainId, account, acp.hash);

    // Verify data exists
    let storedData = localStorage.getItem('cofhesdk-acps');
    expect(storedData).toBeDefined();

    // Remove acp
    removeACP(chainId, account, acp.hash);

    // Verify data is cleaned up
    storedData = localStorage.getItem('cofhesdk-acps');
    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.acps[chainId][account][acp.hash]).toBeUndefined();
    expect(parsedData.state.activeACPHash[chainId][account]).toBeUndefined();
  });
});
