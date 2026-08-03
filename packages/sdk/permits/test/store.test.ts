/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  permitStore,
  getPermit,
  getActivePermit,
  getPermits,
  setPermit,
  removePermit,
  getActivePermitHash,
  setActivePermitHash,
  clearStaleStore,
  PERMIT_STORE_DEFAULTS,
  PermitUtils,
} from '../index.js';

import { createMockPermit } from '../test-utils.js';

describe('Storage Tests', () => {
  const chainId = 1;
  const account = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    permitStore.resetStore();
  });

  afterEach(() => {
    permitStore.resetStore();
  });

  describe('Permit Storage', () => {
    it('should store and retrieve permits', async () => {
      const permit = await createMockPermit();

      setPermit(chainId, account, permit);
      const retrieved = getPermit(chainId, account, permit.hash);

      expect(retrieved).toBeDefined();
      expect(PermitUtils.serialize(retrieved!)).toEqual(PermitUtils.serialize(permit));
    });

    it('should handle multiple permits per account', async () => {
      const permit1 = await createMockPermit();
      const permit2 = await createMockPermit({
        issuer: '0x0987654321098765432109876543210987654321' as `0x${string}`,
      });

      setPermit(chainId, account, permit1);
      setPermit(chainId, account, permit2);

      const permits = getPermits(chainId, account);
      expect(Object.keys(permits)).toHaveLength(2);

      expect(PermitUtils.serialize(permits[permit1.hash])).toEqual(PermitUtils.serialize(permit1));
      expect(PermitUtils.serialize(permits[permit2.hash])).toEqual(PermitUtils.serialize(permit2));
    });

    it('should handle active permit hash', async () => {
      const permit = await createMockPermit();

      setPermit(chainId, account, permit);
      setActivePermitHash(chainId, account, permit.hash);

      const activeHash = getActivePermitHash(chainId, account);
      expect(activeHash).toBe(permit.hash);

      const activePermit = getActivePermit(chainId, account);
      expect(activePermit).toBeDefined();
      expect(PermitUtils.serialize(activePermit!)).toEqual(PermitUtils.serialize(permit));
    });

    it('should remove permits', async () => {
      const permit = await createMockPermit();

      setPermit(chainId, account, permit);
      setActivePermitHash(chainId, account, permit.hash);

      removePermit(chainId, account, permit.hash);

      const retrieved = getPermit(chainId, account, permit.hash);
      expect(retrieved).toBeUndefined();

      const activeHash = getActivePermitHash(chainId, account);
      expect(activeHash).toBeUndefined();
    });
  });

  describe('Stale Store Detection', () => {
    // `typeof null` and `typeof []` are both 'object', so these shapes used to pass
    // the structure guard and only blow up later on `permits[chainId]`.
    const seedRawState = (state: unknown) => {
      permitStore.store.setState(state as never, true);
    };

    it('should clear the store when permits is null', () => {
      seedRawState({ permits: null, activePermitHash: {} });

      clearStaleStore();

      expect(permitStore.store.getState()).toEqual(PERMIT_STORE_DEFAULTS);
      expect(() => getPermit(chainId, account, '0xdeadbeef')).not.toThrow();
      expect(getPermit(chainId, account, '0xdeadbeef')).toBeUndefined();
    });

    it('should clear the store when permits is an array', () => {
      seedRawState({ permits: [], activePermitHash: {} });

      clearStaleStore();

      expect(permitStore.store.getState()).toEqual(PERMIT_STORE_DEFAULTS);
      expect(() => getPermit(chainId, account, '0xdeadbeef')).not.toThrow();
      expect(getPermit(chainId, account, '0xdeadbeef')).toBeUndefined();
    });

    it('should clear the store when activePermitHash is null', () => {
      seedRawState({ permits: {}, activePermitHash: null });

      clearStaleStore();

      expect(permitStore.store.getState()).toEqual(PERMIT_STORE_DEFAULTS);
      expect(() => getActivePermit(chainId, account)).not.toThrow();
      expect(getActivePermit(chainId, account)).toBeUndefined();
    });

    it('should leave a valid store untouched', async () => {
      const permit = await createMockPermit();
      setPermit(chainId, account, permit);
      setActivePermitHash(chainId, account, permit.hash);

      const before = permitStore.store.getState();

      clearStaleStore();

      expect(permitStore.store.getState()).toEqual(before);
      expect(PermitUtils.serialize(getPermit(chainId, account, permit.hash)!)).toEqual(PermitUtils.serialize(permit));
      expect(getActivePermitHash(chainId, account)).toBe(permit.hash);
    });
  });
});
