/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  acpStore,
  getACP,
  getActiveACP,
  getACPs,
  setACP,
  removeACP,
  getActiveACPHash,
  setActiveACPHash,
  clearStaleStore,
  ACP_STORE_DEFAULTS,
  ACPUtils,
} from '../index.js';

import { createMockACP } from '../test-utils.js';

describe('Storage Tests', () => {
  const chainId = 1;
  const account = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    acpStore.resetStore();
  });

  afterEach(() => {
    acpStore.resetStore();
  });

  describe('ACP Storage', () => {
    it('should store and retrieve acps', async () => {
      const acp = await createMockACP();

      setACP(chainId, account, acp);
      const retrieved = getACP(chainId, account, acp.hash);

      expect(retrieved).toBeDefined();
      expect(ACPUtils.serialize(retrieved!)).toEqual(ACPUtils.serialize(acp));
    });

    it('should handle multiple acps per account', async () => {
      const acp1 = await createMockACP();
      const acp2 = await createMockACP({
        issuer: '0x0987654321098765432109876543210987654321' as `0x${string}`,
      });

      setACP(chainId, account, acp1);
      setACP(chainId, account, acp2);

      const acps = getACPs(chainId, account);
      expect(Object.keys(acps)).toHaveLength(2);

      expect(ACPUtils.serialize(acps[acp1.hash])).toEqual(ACPUtils.serialize(acp1));
      expect(ACPUtils.serialize(acps[acp2.hash])).toEqual(ACPUtils.serialize(acp2));
    });

    it('should handle active acp hash', async () => {
      const acp = await createMockACP();

      setACP(chainId, account, acp);
      setActiveACPHash(chainId, account, acp.hash);

      const activeHash = getActiveACPHash(chainId, account);
      expect(activeHash).toBe(acp.hash);

      const activeACP = getActiveACP(chainId, account);
      expect(activeACP).toBeDefined();
      expect(ACPUtils.serialize(activeACP!)).toEqual(ACPUtils.serialize(acp));
    });

    it('should remove acps', async () => {
      const acp = await createMockACP();

      setACP(chainId, account, acp);
      setActiveACPHash(chainId, account, acp.hash);

      removeACP(chainId, account, acp.hash);

      const retrieved = getACP(chainId, account, acp.hash);
      expect(retrieved).toBeUndefined();

      const activeHash = getActiveACPHash(chainId, account);
      expect(activeHash).toBeUndefined();
    });
  });

  describe('Stale Store Detection', () => {
    // `typeof null` and `typeof []` are both 'object', so these shapes used to pass the
    // structure guard and stay in the store; a `null` record then throws on `acps[chainId]`.
    const seedRawState = (state: unknown) => {
      acpStore.store.setState(state as never, true);
    };

    it('should clear the store when acps is null', () => {
      seedRawState({ acps: null, activeACPHash: {} });

      clearStaleStore();

      expect(acpStore.store.getState()).toEqual(ACP_STORE_DEFAULTS);
      expect(() => getACP(chainId, account, '0xdeadbeef')).not.toThrow();
      expect(getACP(chainId, account, '0xdeadbeef')).toBeUndefined();
    });

    it('should clear the store when acps is an array', () => {
      seedRawState({ acps: [], activeACPHash: {} });

      clearStaleStore();

      expect(acpStore.store.getState()).toEqual(ACP_STORE_DEFAULTS);
      expect(() => getACP(chainId, account, '0xdeadbeef')).not.toThrow();
      expect(getACP(chainId, account, '0xdeadbeef')).toBeUndefined();
    });

    it('should clear the store when activeACPHash is null', () => {
      seedRawState({ acps: {}, activeACPHash: null });

      clearStaleStore();

      expect(acpStore.store.getState()).toEqual(ACP_STORE_DEFAULTS);
      expect(() => getActiveACP(chainId, account)).not.toThrow();
      expect(getActiveACP(chainId, account)).toBeUndefined();
    });

    it('should clear the store when activeACPHash is an array', () => {
      seedRawState({ acps: {}, activeACPHash: [] });

      clearStaleStore();

      expect(acpStore.store.getState()).toEqual(ACP_STORE_DEFAULTS);
    });

    it('should let setACP recover a store whose acps is null', async () => {
      const acp = await createMockACP();
      seedRawState({ acps: null, activeACPHash: {} });

      expect(() => setACP(chainId, account, acp)).not.toThrow();
      expect(ACPUtils.serialize(getACP(chainId, account, acp.hash)!)).toEqual(ACPUtils.serialize(acp));
    });

    it('should leave a valid store untouched', async () => {
      const acp = await createMockACP();
      setACP(chainId, account, acp);
      setActiveACPHash(chainId, account, acp.hash);

      const before = acpStore.store.getState();

      clearStaleStore();

      // Same reference: a valid store must not be rewritten at all.
      expect(acpStore.store.getState()).toBe(before);
      expect(ACPUtils.serialize(getACP(chainId, account, acp.hash)!)).toEqual(ACPUtils.serialize(acp));
      expect(getActiveACPHash(chainId, account)).toBe(acp.hash);
    });
  });
});
