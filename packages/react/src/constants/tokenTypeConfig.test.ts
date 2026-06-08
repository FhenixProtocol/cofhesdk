import { describe, expect, it } from 'vitest';

import {
  TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS,
  TOKEN_TYPE_CONFIG,
  type TokenConfidentialityType,
  type TokenTypeConfig,
} from './tokenTypeConfig';

describe('TOKEN_TYPE_CONFIG', () => {
  it('defines detection and contract config for every enabled token type', () => {
    for (const [confidentialityType, config] of Object.entries(TOKEN_TYPE_CONFIG) as Array<
      [TokenConfidentialityType, TokenTypeConfig]
    >) {
      if (!config.enabled) continue;

      const interfaceIds = TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS as Partial<
        Record<TokenConfidentialityType, string>
      >;

      expect(interfaceIds[confidentialityType]).toMatch(/^0x[0-9a-f]{8}$/);
      expect(config.contracts?.confidentialBalance).toBeDefined();
      expect(config.contracts?.confidentialTransfer).toBeDefined();

      if (config.operations.shield) {
        expect(config.contracts?.shield).toBeDefined();
      }
      if (config.operations.unshield) {
        expect(config.contracts?.unshield).toBeDefined();
      }
      if (config.operations.claimable) {
        expect(config.contracts?.claims?.query).toBeDefined();
      }
      if (config.claimSubmission === 'single') {
        expect(config.contracts?.claims?.single).toBeDefined();
      }
      if (config.claimSubmission === 'batch') {
        expect(config.contracts?.claims?.all).toBeDefined();
      }
      if (config.pairGetterFunctionNames?.length) {
        expect(config.nativeContracts?.shield?.native).toBeDefined();
      }
    }
  });
});
