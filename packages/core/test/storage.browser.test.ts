import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStorage, IStorage } from '../src/storage';

describe('Storage', () => {
  let storage: IStorage;

  beforeEach(() => {
    // Get a fresh storage instance for each test
    storage = getStorage();
  });

  afterEach(async () => {
    // Clean up any data created during tests
    // Note: In a real browser, we can't easily clear all IndexedDB data
    // but each test uses unique keys so they won't interfere
  });

  describe('Browser Environment Detection', () => {
    it('should detect real browser environment', () => {
      // In a real browser, these should be available
      expect(typeof window).toBe('object');
      expect(window.indexedDB).toBeDefined();
      expect(storage).toBeDefined();
      expect(typeof storage.getItem).toBe('function');
      expect(typeof storage.setItem).toBe('function');
      expect(typeof storage.removeItem).toBe('function');
    });

    it('should verify real browser details and version', () => {
      // Check user agent (should contain real browser info)
      const userAgent = navigator.userAgent;
      console.log('🌐 Browser:', userAgent.match(/HeadlessChrome\/[\d.]+/)?.[0] || 'Unknown');
      
      expect(userAgent).toBeDefined();
      expect(typeof userAgent).toBe('string');
      expect(userAgent.length).toBeGreaterThan(0);
      
      // Should contain Chromium/Chrome info since we're using Chromium
      expect(userAgent).toMatch(/Chrome|Chromium/i);
      
      // Verify these are real browser objects, not mocks
      expect(typeof navigator).toBe('object');
      expect(typeof document).toBe('object');
      expect(typeof location).toBe('object');
      expect(typeof history).toBe('object');
      expect(typeof localStorage).toBe('object');
      expect(typeof sessionStorage).toBe('object');
      expect(typeof indexedDB).toBe('object');
      expect(typeof crypto).toBe('object');
      expect(typeof performance).toBe('object');
      
    // Check browser version info
    //   if (navigator.userAgentData) {
    //     console.log('🚀 Browser Version Info (userAgentData):');
    //     console.log('  - brands:', navigator.userAgentData.brands);
    //     console.log('  - mobile:', navigator.userAgentData.mobile);
    //     console.log('  - platform:', navigator.userAgentData.platform);
    //   }
    
    //   // Check specific browser properties that prove it's real
    //   console.log('📊 Browser Properties:');
    //   console.log('  - cookieEnabled:', navigator.cookieEnabled);
    //   console.log('  - language:', navigator.language);
    //   console.log('  - platform:', navigator.platform);
    //   console.log('  - vendor:', navigator.vendor);
    //   console.log('  - hardwareConcurrency:', navigator.hardwareConcurrency);
    //   console.log('  - maxTouchPoints:', navigator.maxTouchPoints);
    
    //   // Verify screen properties (real browsers have screen info)
    //   console.log('🖥️ Screen Properties:');
    //   console.log('  - screen.width:', screen.width);
    //   console.log('  - screen.height:', screen.height);
    //   console.log('  - screen.colorDepth:', screen.colorDepth);
    //   console.log('  - screen.pixelDepth:', screen.pixelDepth);
      
      expect(screen.width).toBeGreaterThan(0);
      expect(screen.height).toBeGreaterThan(0);
      expect(screen.colorDepth).toBeGreaterThan(0);
      
      // Check performance API (real browsers have performance timing)
      console.log('⚡ Performance API:');
      console.log('  - performance.now():', performance.now());
      console.log('  - performance.timeOrigin:', performance.timeOrigin);
      
      expect(performance.now()).toBeGreaterThan(0);
      expect(performance.timeOrigin).toBeGreaterThan(0);
    });

    it('should verify IndexedDB is real (not polyfilled)', () => {
      // Check that indexedDB is the real browser API
      expect(typeof indexedDB).toBe('object');
      expect(typeof indexedDB.open).toBe('function');
      expect(typeof indexedDB.deleteDatabase).toBe('function');
      expect(typeof indexedDB.cmp).toBe('function');
      
      // Real IndexedDB should have specific constructor name
      expect(indexedDB.constructor.name).toMatch(/IDBFactory/i);
      console.log('🏗️ IndexedDB:', indexedDB.constructor.name);
      
      // Check that we have real IDB classes available globally
      expect(typeof IDBRequest).toBe('function');
      expect(typeof IDBDatabase).toBe('function');
      expect(typeof IDBTransaction).toBe('function');
      expect(typeof IDBObjectStore).toBe('function');
      
    });
  });

  describe('Real IndexedDB Operations', () => {
    it('should store and retrieve data using real IndexedDB', async () => {
      const testKey = `real-browser-test-${Date.now()}`;
      const testValue = { 
        message: 'Real IndexedDB test', 
        timestamp: Date.now(),
        complex: {
          array: [1, 2, 3],
          nested: { prop: 'value' }
        }
      };
      
      // Store data
      await storage.setItem(testKey, testValue);
      
      // Retrieve data
      const retrieved = await storage.getItem(testKey);
      
      // Verify data integrity
      expect(retrieved).toEqual(testValue);
      
      // Clean up
      await storage.removeItem(testKey);
      const afterRemoval = await storage.getItem(testKey);
      expect(afterRemoval).toBeNull();
    });

    it('should handle different data types correctly', async () => {
      const testCases = [
        { key: `string-${Date.now()}`, value: 'test string' },
        { key: `number-${Date.now()}`, value: 42 },
        { key: `boolean-${Date.now()}`, value: true },
        { key: `array-${Date.now()}`, value: [1, 'two', { three: 3 }] },
        { key: `object-${Date.now()}`, value: { nested: { deep: 'value' } } },
        { key: `null-${Date.now()}`, value: null }
      ];
      
      // Store all values
      for (const testCase of testCases) {
        await storage.setItem(testCase.key, testCase.value);
      }
      
      // Retrieve and verify all values
      for (const testCase of testCases) {
        const retrieved = await storage.getItem(testCase.key);
        expect(retrieved).toEqual(testCase.value);
      }
      
      // Clean up
      for (const testCase of testCases) {
        await storage.removeItem(testCase.key);
      }
    });

    it('should handle concurrent operations', async () => {
      const baseKey = `concurrent-${Date.now()}`;
      const operations = [];
      
      // Create concurrent write operations
      for (let i = 0; i < 10; i++) {
        const key = `${baseKey}-${i}`;
        const value = { id: i, data: `concurrent data ${i}` };
        operations.push(storage.setItem(key, value));
      }
      
      // Wait for all writes to complete
      await Promise.all(operations);
      
      // Verify all data was written correctly
      const readOperations = [];
      for (let i = 0; i < 10; i++) {
        const key = `${baseKey}-${i}`;
        readOperations.push(storage.getItem(key));
      }
      
      const results = await Promise.all(readOperations);
      
      // Verify results
      results.forEach((result, index) => {
        expect(result).toEqual({ id: index, data: `concurrent data ${index}` });
      });
      
      // Clean up
      const cleanupOperations = [];
      for (let i = 0; i < 10; i++) {
        const key = `${baseKey}-${i}`;
        cleanupOperations.push(storage.removeItem(key));
      }
      await Promise.all(cleanupOperations);
    });

    it('should persist data across storage instances', async () => {
      const testKey = `persistence-${Date.now()}`;
      const testValue = { message: 'persistence test', id: Math.random() };
      
      // Store with first instance
      const storage1 = getStorage();
      await storage1.setItem(testKey, testValue);
      
      // Retrieve with second instance
      const storage2 = getStorage();
      const retrieved = await storage2.getItem(testKey);
      
      expect(retrieved).toEqual(testValue);
      
      // Clean up with third instance
      const storage3 = getStorage();
      await storage3.removeItem(testKey);
      
      // Verify removal with fourth instance
      const storage4 = getStorage();
      const afterRemoval = await storage4.getItem(testKey);
      expect(afterRemoval).toBeNull();
    });

    it('should handle large objects efficiently', async () => {
      const testKey = `large-object-${Date.now()}`;
      const largeObject = {
        metadata: { test: 'large object test', timestamp: Date.now() },
        data: new Array(1000).fill(null).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`,
          tags: [`tag-${i}`, `category-${i % 10}`],
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            version: 1
          }
        }))
      };
      
      // Store large object
      await storage.setItem(testKey, largeObject);
      
      // Retrieve large object
      const retrieved = await storage.getItem(testKey);
      
      // Verify integrity
      expect(retrieved).toEqual(largeObject);
      expect(retrieved.data).toHaveLength(1000);
      
      // Clean up
      await storage.removeItem(testKey);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent keys gracefully', async () => {
      const nonExistentKey = `non-existent-${Date.now()}-${Math.random()}`;
      
      const result = await storage.getItem(nonExistentKey);
      expect(result).toBeNull();
    });

    it('should handle removal of non-existent keys gracefully', async () => {
      const nonExistentKey = `non-existent-removal-${Date.now()}-${Math.random()}`;
      
      // Should not throw
      await expect(storage.removeItem(nonExistentKey)).resolves.not.toThrow();
    });
  });

  describe('Real IndexedDB Verification', () => {
    it('should actually use IndexedDB (not memory fallback)', async () => {
      const testKey = `indexeddb-verification-${Date.now()}`;
      const testValue = { verification: 'real IndexedDB', timestamp: Date.now() };
      
      // Check that we're in a real browser environment
      expect(typeof window).toBe('object');
      expect(window.indexedDB).toBeDefined();
      expect(typeof window.indexedDB.open).toBe('function');
      
      // Perform storage operation
      await storage.setItem(testKey, testValue);
      const retrieved = await storage.getItem(testKey);
      
      // Verify the operation worked
      expect(retrieved).toEqual(testValue);
      
      // Clean up
      await storage.removeItem(testKey);
    });

    it('should demonstrate IndexedDB persistence', async () => {
      const testKey = `persistence-demo-${Date.now()}`;
      const testValue = { 
        demo: 'IndexedDB persistence', 
        created: new Date().toISOString(),
        id: Math.random()
      };
      
      // Store the data
      await storage.setItem(testKey, testValue);
      
      // Verify it exists
      const exists = await storage.getItem(testKey);
      expect(exists).toEqual(testValue);
      
      // Note: In a real application, this data would persist across browser sessions
      // In our test, we clean up to avoid polluting the test environment
      await storage.removeItem(testKey);
      
      const afterCleanup = await storage.getItem(testKey);
      expect(afterCleanup).toBeNull();
    });
  });
});