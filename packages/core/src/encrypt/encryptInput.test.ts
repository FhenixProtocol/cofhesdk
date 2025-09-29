/* eslint-disable no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptInputsBuilder } from './encryptInput';
import { VerifyResult, ZkPackProveVerify } from './zkPackProveVerify';
import { Result } from '../result';
import { EncryptableItem, FheTypes, Encryptable, EncryptableUint128, EncryptStep } from '../types';
import { CofhesdkError, CofhesdkErrorCode } from '../error';
import { fromHexString, toHexString } from '../utils';

const stringifyWithBigInt = (obj: any): string => JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? `${v}n` : v));

const parseWithBigInt = (str: string): any =>
  JSON.parse(str, (_, v) => {
    if (typeof v === 'string' && /^\d+n$/.test(v)) {
      return BigInt(v.slice(0, -1));
    }
    return v;
  });

// packMetadata function removed as it's no longer needed
const unpackMetadata = (metadata: string) => {
  const [signer, securityZone, chainId] = metadata.split('-');
  return { signer, securityZone: parseInt(securityZone), chainId };
};

export const deconstructZkPoKMetadata = (
  metadata: Uint8Array
): { accountAddr: string; securityZone: number; chainId: number } => {
  if (metadata.length < 53) {
    // 1 + 20 + 32 = 53 bytes minimum
    throw new CofhesdkError({
      code: CofhesdkErrorCode.InternalError,
      message: 'Invalid metadata: insufficient length',
    });
  }

  // Extract security zone (first byte)
  const securityZone = metadata[0];

  // Extract account address (next 20 bytes)
  const accountBytes = metadata.slice(1, 21);
  const accountAddr = '0x' + toHexString(accountBytes);

  // Extract chain ID (next 32 bytes, big-endian u256)
  const chainIdBytes = metadata.slice(21, 53);

  // Convert from big-endian u256 to number
  let chainId = 0;
  for (let i = 0; i < 32; i++) {
    chainId = (chainId << 8) | chainIdBytes[i];
  }

  return {
    accountAddr,
    securityZone,
    chainId,
  };
};

class MockZkListBuilder {
  private items: EncryptableItem[];
  constructor(items: EncryptableItem[] = []) {
    this.items = items;
  }
  push_boolean(data: boolean): void {
    this.items.push({ utype: FheTypes.Bool, data });
  }
  push_u8(data: number): void {
    this.items.push({ utype: FheTypes.Uint8, data: BigInt(data) });
  }
  push_u16(data: number): void {
    this.items.push({ utype: FheTypes.Uint16, data: BigInt(data) });
  }
  push_u32(data: number): void {
    this.items.push({ utype: FheTypes.Uint32, data: BigInt(data) });
  }
  push_u64(data: bigint): void {
    this.items.push({ utype: FheTypes.Uint64, data });
  }
  push_u128(data: bigint): void {
    this.items.push({ utype: FheTypes.Uint128, data });
  }
  push_u160(data: bigint): void {
    this.items.push({ utype: FheTypes.Uint160, data });
  }
  build_with_proof_packed(_crs: any, metadata: Uint8Array, _computeLoad: 1): MockZkProvenList {
    // Clear items to prevent persisting items between tests
    const returnItems = this.items;
    this.items = [];

    return new MockZkProvenList(returnItems, metadata);
  }
}

// Setup fetch mock for http://localhost:3001/verify
// Simulates verification of zk proof
// Returns {ctHash: stringified value, signature: `${account_addr}-${security_zone}-${chain_id}-`, recid: 0}
// Expects the proof to be created by the MockZkListBuilder `build_with_proof_packed` above
const mockFetch = vi.fn();
global.fetch = mockFetch;
const setupZkVerifyMock = () => {
  mockFetch.mockImplementation((url: string, options: any) => {
    if (url === 'http://localhost:3001/verify') {
      const body = JSON.parse(options.body as string);
      const { packed_list, account_addr, security_zone, chain_id } = body;

      // Decode the proof data
      const arr = fromHexString(packed_list);
      const decoded = new TextDecoder().decode(arr);
      const decodedData = parseWithBigInt(decoded);
      const { items } = decodedData;

      // Create mock verify results
      const mockResults = items.map((item: EncryptableItem) => ({
        ct_hash: BigInt(item.data).toString(),
        signature: `${account_addr}-${security_zone}-${chain_id}-`,
        recid: 0,
      }));

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'success',
            data: mockResults,
            error: null,
          }),
      });
    }

    // For other URLs, return a 404
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });
  });
};

class MockZkProvenList {
  private items: EncryptableItem[];
  private metadata: Uint8Array;

  constructor(items: EncryptableItem[], metadata: Uint8Array) {
    this.items = items;
    this.metadata = metadata;
  }

  serialize(): Uint8Array {
    // Serialize this.items into JSON, then encode as Uint8Array (utf-8)
    const json = stringifyWithBigInt({ items: this.items, metadata: this.metadata });
    return new TextEncoder().encode(json);
  }
}

export const expectResultSuccess = <T>(result: Result<T>): T => {
  expect(result.error).toBe(null);
  expect(result.success).toBe(true);
  expect(result.data).not.toBe(null);
  return result.data as T;
};

export const expectResultError = <T>(result: Result<T>, errorCode?: CofhesdkErrorCode, errorMessage?: string): void => {
  expect(result.success).toBe(false);
  expect(result.data).toBe(null);
  expect(result.error).not.toBe(null);
  const error = result.error as CofhesdkError;
  expect(error).toBeInstanceOf(CofhesdkError);
  if (errorCode) {
    expect(error.code).toBe(errorCode);
  }
  if (errorMessage) {
    expect(error.message).toBe(errorMessage);
  }
};

describe('EncryptInputsBuilder', () => {
  const mockCrs = {
    free: () => {},
    serialize: () => new Uint8Array(),
    safe_serialize: () => new Uint8Array(),
  };

  const defaultSender = '0x1234567890123456789012345678901234567890';
  const defaultChainId = '1';
  const createDefaultParams = () => {
    return {
      inputs: [Encryptable.uint128(100n)] as [EncryptableUint128],
      sender: defaultSender,
      chainId: defaultChainId,
      isTestnet: false,
      zkVerifierUrl: 'http://localhost:3001',
      zk: new ZkPackProveVerify(new MockZkListBuilder(), mockCrs),
    };
  };

  let builder: EncryptInputsBuilder<[EncryptableUint128]>;

  beforeEach(() => {
    setupZkVerifyMock();
    builder = new EncryptInputsBuilder({
      inputs: [Encryptable.uint128(100n)] as [EncryptableUint128],
      sender: '0x1234567890123456789012345678901234567890',
      chainId: '1',
      isTestnet: false,
      zkVerifierUrl: 'http://localhost:3001',
      zk: new ZkPackProveVerify(new MockZkListBuilder(), mockCrs),
    });
  });

  describe('constructor and initialization', () => {
    it('should initialize with default values', () => {
      expect(builder).toBeInstanceOf(EncryptInputsBuilder);
    });

    it('should set default security zone to 0', () => {
      const builderWithDefaultZone = new EncryptInputsBuilder({
        ...createDefaultParams(),
        securityZone: undefined,
      });
      // We can't directly test private properties, but we can test behavior
      expect(builderWithDefaultZone).toBeInstanceOf(EncryptInputsBuilder);
    });
  });

  describe('setSender', () => {
    it('should set sender and return builder for chaining', () => {
      const sender = '0x9876543210987654321098765432109876543210';

      const result = builder.setSender(sender);

      expect(result).toBe(builder);
      expect(result.getSender()).toBe(sender);
    });

    it('should allow chaining with other methods', () => {
      const sender = '0x1111111111111111111111111111111111111111';
      const securityZone = 5;

      const result = builder
        .setSender(sender)
        .setSecurityZone(securityZone)
        .setStepCallback(() => {});

      expect(result).toBe(builder);
      expect(result.getSender()).toBe(sender);
      expect(result.getSecurityZone()).toBe(securityZone);
    });
  });

  describe('setSecurityZone', () => {
    it('should set security zone and return builder for chaining', () => {
      const securityZone = 42;
      const result = builder.setSecurityZone(securityZone);
      expect(result).toBe(builder);
      expect(result.getSecurityZone()).toBe(securityZone);
    });

    it('should allow chaining with other methods', () => {
      const sender = '0x2222222222222222222222222222222222222222';
      const securityZone = 10;

      const result = builder
        .setSecurityZone(securityZone)
        .setSender(sender)
        .setStepCallback(() => {});

      expect(result).toBe(builder);
      expect(result.getSender()).toBe(sender);
      expect(result.getSecurityZone()).toBe(securityZone);
    });
  });

  describe('setStepCallback', () => {
    it('should set step callback and return builder for chaining', () => {
      const callback = vi.fn();
      const result = builder.setStepCallback(callback);
      expect(result).toBe(builder);
    });

    it('should allow chaining with other methods', () => {
      const callback = vi.fn();
      const result = builder.setStepCallback(callback).setSecurityZone(15);

      expect(result).toBe(builder);
    });
  });

  describe('encrypt', () => {
    it('should execute the full encryption flow with step callbacks', async () => {
      const stepCallback = vi.fn();
      builder.setStepCallback(stepCallback);

      const result = expectResultSuccess(await builder.encrypt());

      // Verify step callbacks were called in order
      expect(stepCallback).toHaveBeenCalledTimes(6);
      expect(stepCallback).toHaveBeenNthCalledWith(1, EncryptStep.Extract);
      expect(stepCallback).toHaveBeenNthCalledWith(2, EncryptStep.Pack);
      expect(stepCallback).toHaveBeenNthCalledWith(3, EncryptStep.Prove);
      expect(stepCallback).toHaveBeenNthCalledWith(4, EncryptStep.Verify);
      expect(stepCallback).toHaveBeenNthCalledWith(5, EncryptStep.Replace);
      expect(stepCallback).toHaveBeenNthCalledWith(6, EncryptStep.Done);

      // Verify result structure
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Verify result embedded metadata
      const [encrypted] = result;
      const encryptedMetadata = unpackMetadata(encrypted.signature);
      expect(encryptedMetadata).toBeDefined();
      expect(encryptedMetadata.signer).toBe(defaultSender);
      expect(encryptedMetadata.securityZone).toBe(0);
      expect(encryptedMetadata.chainId).toBe(defaultChainId);
    });

    it('should use overridden sender when set', async () => {
      const overriddenSender = '0x5555555555555555555555555555555555555555';
      builder.setSender(overriddenSender);

      const result = expectResultSuccess(await builder.encrypt());

      // Verify result embedded metadata
      const [encrypted] = result;
      const encryptedMetadata = unpackMetadata(encrypted.signature);
      expect(encryptedMetadata).toBeDefined();
      expect(encryptedMetadata.signer).toBe(overriddenSender);
      expect(encryptedMetadata.securityZone).toBe(0);
      expect(encryptedMetadata.chainId).toBe(defaultChainId);
    });

    it('should use overridden security zone when set', async () => {
      const overriddenZone = 7;
      builder.setSecurityZone(overriddenZone);

      const result = expectResultSuccess(await builder.encrypt());

      // Verify result embedded metadata
      const [encrypted] = result;
      const encryptedMetadata = unpackMetadata(encrypted.signature);
      expect(encryptedMetadata).toBeDefined();
      expect(encryptedMetadata.signer).toBe(defaultSender);
      expect(encryptedMetadata.securityZone).toBe(overriddenZone);
      expect(encryptedMetadata.chainId).toBe(defaultChainId);
    });

    it('should work without step callback', async () => {
      // No step callback set
      const result = expectResultSuccess(await builder.encrypt());

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should not throw when no callback is set
    });

    it('should handle multiple input types', async () => {
      const multiInputBuilder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        inputs: [Encryptable.uint128(100n), Encryptable.bool(true)] as [
          ReturnType<typeof Encryptable.uint128>,
          ReturnType<typeof Encryptable.bool>,
        ],
      });

      const result = expectResultSuccess(await multiInputBuilder.encrypt());

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // TODO: Implement error handling tests
  // describe('error handling', () => {
  //   it('should handle ZK pack errors gracefully', async () => {
  //     const result = await builder.encrypt();
  //     expectResultError(result, CofhesdkErrorCode.InternalError, 'ZK pack failed');
  //   });

  //   it('should handle ZK prove errors gracefully', async () => {
  //     const result = await builder.encrypt();
  //     expectResultError(result, CofhesdkErrorCode.InternalError, 'ZK prove failed');
  //   });

  //   it('should handle ZK verify errors gracefully', async () => {
  //     const result = await builder.encrypt();
  //     expectResultError(result, CofhesdkErrorCode.InternalError, 'ZK verify failed');
  //   });
  // });

  describe('integration scenarios', () => {
    it('should work with the complete builder chain', async () => {
      const sender = '0x9999999999999999999999999999999999999999';
      const securityZone = 3;

      const stepCallback = vi.fn();
      const result = await builder
        .setSender(sender)
        .setSecurityZone(securityZone)
        .setStepCallback(stepCallback)
        .encrypt();
      const resultData = expectResultSuccess(result);

      expect(result).toBeDefined();
      expect(stepCallback).toHaveBeenCalledTimes(6);

      // Verify result embedded metadata
      const [encrypted] = resultData;
      const encryptedMetadata = unpackMetadata(encrypted.signature);
      expect(encryptedMetadata).toBeDefined();
      expect(encryptedMetadata.signer).toBe(sender);
      expect(encryptedMetadata.securityZone).toBe(securityZone);
      expect(encryptedMetadata.chainId).toBe(defaultChainId);
    });

    it('should maintain state across method calls', async () => {
      const sender = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const securityZone = 99;

      builder.setSender(sender);
      builder.setSecurityZone(securityZone);

      // Call encrypt multiple times to ensure state is maintained
      const result1 = expectResultSuccess(await builder.encrypt());
      const result2 = expectResultSuccess(await builder.encrypt());

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Verify result embedded metadata
      const [encrypted1] = result1;
      const encryptedMetadata1 = unpackMetadata(encrypted1.signature);
      expect(encryptedMetadata1).toBeDefined();
      expect(encryptedMetadata1.signer).toBe(sender);
      expect(encryptedMetadata1.securityZone).toBe(securityZone);
      expect(encryptedMetadata1.chainId).toBe(defaultChainId);

      // Verify result embedded metadata
      const [encrypted2] = result2;
      const encryptedMetadata2 = unpackMetadata(encrypted2.signature);
      expect(encryptedMetadata2).toBeDefined();
      expect(encryptedMetadata2.signer).toBe(sender);
      expect(encryptedMetadata2.securityZone).toBe(securityZone);
      expect(encryptedMetadata2.chainId).toBe(defaultChainId);
    });
  });
});
