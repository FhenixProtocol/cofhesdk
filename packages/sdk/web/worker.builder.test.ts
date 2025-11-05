import { describe, it, expect } from 'vitest';
import { createCofhesdkClient, createCofhesdkConfig } from './index.js';
import { Encryptable } from '@/core';
import { arbSepolia as cofhesdkArbSepolia } from '@/chains';

describe('@cofhesdk/web - EncryptInputsBuilder Worker Methods', () => {

  describe('setUseWorker method', () => {
    it('should have setUseWorker method on EncryptInputsBuilder', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      expect(builder).toHaveProperty('setUseWorker');
      expect(typeof builder.setUseWorker).toBe('function');
    });

    it('should return builder for method chaining', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);
      const returnedBuilder = builder.setUseWorker(false);

      // Should return the same builder instance (or at least same type)
      expect(returnedBuilder).toBe(builder);
    });

    it('should allow chaining with other builder methods', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      
      // Should be able to chain setUseWorker with setStepCallback
      const builder = client
        .encryptInputs([Encryptable.uint128(100n)])
        .setUseWorker(false)
        .setStepCallback(() => {});

      expect(builder).toBeDefined();
      expect(builder).toHaveProperty('encrypt');
    });

    it('should accept true parameter', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      
      expect(() => {
        client
          .encryptInputs([Encryptable.uint128(100n)])
          .setUseWorker(true);
      }).not.toThrow();
    });

    it('should accept false parameter', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      
      expect(() => {
        client
          .encryptInputs([Encryptable.uint128(100n)])
          .setUseWorker(false);
      }).not.toThrow();
    });

    it('should have getUseWorker method', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      expect(builder).toHaveProperty('getUseWorker');
      expect(typeof builder.getUseWorker).toBe('function');
    });

    it('should return current useWorker value', () => {
      const configWithWorkers = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      const configWithoutWorkers = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false,
      });

      const clientWithWorkers = createCofhesdkClient(configWithWorkers);
      const clientWithoutWorkers = createCofhesdkClient(configWithoutWorkers);

      const builderWithWorkers = clientWithWorkers.encryptInputs([Encryptable.uint128(100n)]);
      const builderWithoutWorkers = clientWithoutWorkers.encryptInputs([Encryptable.uint128(100n)]);

      // Should reflect config values
      expect(builderWithWorkers.getUseWorker()).toBe(true);
      expect(builderWithoutWorkers.getUseWorker()).toBe(false);
    });

    it('should reflect changes from setUseWorker', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      const client = createCofhesdkClient(config);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      // Initial value from config
      expect(builder.getUseWorker()).toBe(true);

      // After setting to false
      builder.setUseWorker(false);
      expect(builder.getUseWorker()).toBe(false);

      // After setting back to true
      builder.setUseWorker(true);
      expect(builder.getUseWorker()).toBe(true);
    });
  });

  describe('Worker function availability', () => {
    it('should initialize client without errors', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      expect(() => {
        createCofhesdkClient(config);
      }).not.toThrow();
    });

    it('should handle worker function when workers enabled', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      const client = createCofhesdkClient(config);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      // Should not throw even though workers aren't available in Node
      expect(() => {
        builder.setUseWorker(true);
      }).not.toThrow();
    });

    it('should handle when workers disabled', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false,
      });

      const client = createCofhesdkClient(config);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      expect(() => {
        builder.setUseWorker(false);
      }).not.toThrow();
    });
  });
});

