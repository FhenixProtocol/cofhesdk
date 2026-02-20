/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPermit,
  setPermit,
  removePermit,
  getActivePermitHash,
  setActivePermitHash,
  PermitUtils,
  permitStore,
} from './index.js';
import { createMockPermit } from './test-utils.js';

// Type declarations for happy-dom environment
declare const localStorage: {
  clear: () => void;
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
};

describe('Permits localStorage Tests', () => {
  const chainId = 1;
  const account = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    // Clear localStorage and reset store state
    localStorage.clear();
    permitStore.resetStore();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    permitStore.resetStore();
  });

  it('should persist permits to localStorage', async () => {
    const permit = await createMockPermit();

    setPermit(chainId, account, permit);

    // Verify data is stored in localStorage
    const storedData = localStorage.getItem('cofhesdk-permits');
    expect(storedData).toBeDefined();

    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.permits[chainId][account][permit.hash]).toBeDefined();
  });

  it('should persist active permit hash to localStorage', async () => {
    const permit = await createMockPermit();

    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, permit.hash);

    // Verify active permit hash is stored
    const storedData = localStorage.getItem('cofhesdk-permits');
    expect(storedData).toBeDefined();

    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.activePermitHash[chainId][account]).toBe(permit.hash);
  });

  it('should restore permits from localStorage', async () => {
    const permit = await createMockPermit();

    // Add permit to localStorage
    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, permit.hash);
    const serializedPermit = PermitUtils.serialize(permit);

    // Verify data is restored
    const retrievedPermit = getPermit(chainId, account, permit.hash);
    expect(retrievedPermit).toBeDefined();
    expect(PermitUtils.serialize(retrievedPermit!)).toEqual(serializedPermit);

    const activeHash = getActivePermitHash(chainId, account);
    expect(activeHash).toBe(permit.hash);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('cofhesdk-permits', 'invalid json');

    // Store should handle this gracefully
    expect(() => {
      permitStore.store.getState();
    }).not.toThrow();
  });

  it('should clean up localStorage when permits are removed', async () => {
    const permit = await createMockPermit();

    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, permit.hash);

    // Verify data exists
    let storedData = localStorage.getItem('cofhesdk-permits');
    expect(storedData).toBeDefined();

    // Remove permit
    removePermit(chainId, account, permit.hash);

    // Verify data is cleaned up
    storedData = localStorage.getItem('cofhesdk-permits');
    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.permits[chainId][account][permit.hash]).toBeUndefined();
    expect(parsedData.state.activePermitHash[chainId][account]).toBeUndefined();
  });
});
