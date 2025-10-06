/**
 * @vitest-environment happy-dom
 */
/* eslint-disable no-unused-vars */

// Type declarations for happy-dom environment
declare const localStorage: {
  clear: () => void;
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
};

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPermit,
  setPermit,
  removePermit,
  getActivePermitHash,
  setActivePermitHash,
  PermitUtils,
  permitStore,
} from '../src/index';

import { createMockPermit } from './utils';

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
    const hash = PermitUtils.getHash(permit);

    setPermit(chainId, account, permit);

    // Verify data is stored in localStorage
    const storedData = localStorage.getItem('cofhejs-permits');
    expect(storedData).toBeDefined();

    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.permits[chainId][account][hash]).toBeDefined();
  });

  it('should persist active permit hash to localStorage', async () => {
    const permit = await createMockPermit();
    const hash = PermitUtils.getHash(permit);

    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, hash);

    // Verify active permit hash is stored
    const storedData = localStorage.getItem('cofhejs-permits');
    expect(storedData).toBeDefined();

    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.activePermitHash[chainId][account]).toBe(hash);
  });

  it('should restore permits from localStorage', async () => {
    const permit = await createMockPermit();
    const hash = PermitUtils.getHash(permit);

    // Add permit to localStorage
    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, hash);
    const serializedPermit = PermitUtils.serialize(permit);

    // Verify data is restored
    const retrievedPermit = getPermit(chainId, account, hash);
    expect(retrievedPermit).toBeDefined();
    expect(PermitUtils.serialize(retrievedPermit!)).toEqual(serializedPermit);

    const activeHash = getActivePermitHash(chainId, account);
    expect(activeHash).toBe(hash);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('cofhejs-permits', 'invalid json');

    // Store should handle this gracefully
    expect(() => {
      permitStore.store.getState();
    }).not.toThrow();
  });

  it('should clean up localStorage when permits are removed', async () => {
    const permit = await createMockPermit();
    const hash = PermitUtils.getHash(permit);

    setPermit(chainId, account, permit);
    setActivePermitHash(chainId, account, hash);

    // Verify data exists
    let storedData = localStorage.getItem('cofhejs-permits');
    expect(storedData).toBeDefined();

    // Remove permit
    removePermit(chainId, account, hash, true);

    // Verify data is cleaned up
    storedData = localStorage.getItem('cofhejs-permits');
    const parsedData = JSON.parse(storedData!);
    expect(parsedData.state.permits[chainId][account][hash]).toBeUndefined();
    expect(parsedData.state.activePermitHash[chainId][account]).toBeUndefined();
  });
});
