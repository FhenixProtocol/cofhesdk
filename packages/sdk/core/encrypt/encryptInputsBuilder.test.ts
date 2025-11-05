/* eslint-disable no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncryptInputsBuilder } from './encryptInputsBuilder.js';
import {
  type EncryptableItem,
  FheTypes,
  Encryptable,
  type EncryptableUint128,
  EncryptStep,
  type TfheInitializer,
} from '../types.js';
import { CofhesdkError, CofhesdkErrorCode } from '../error.js';
import { fromHexString, toHexString } from '../utils.js';
import { type PublicClient, createPublicClient, http, type WalletClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { type CofhesdkConfig, createCofhesdkConfigBase } from '../config.js';
import { type ZkBuilderAndCrsGenerator } from './zkPackProveVerify.js';
import { type KeysStorage, createKeysStore } from '../keyStore.js';
import { type FheKeyDeserializer } from '../fetchKeys.js';
import { expectResultSuccess, expectResultError } from '../test-utils.js';

const MockZkVerifierUrl = 'http://localhost:3001';

// Test private keys (well-known test keys from Anvil/Hardhat)
const BOB_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Bob - always issuer

// Create real viem clients for Arbitrum Sepolia
const publicClient: PublicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

const bobWalletClient: WalletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: http(),
  account: privateKeyToAccount(BOB_PRIVATE_KEY),
});

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
  return { signer, securityZone: parseInt(securityZone), chainId: parseInt(chainId) };
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

const MockCrs = {
  free: () => {},
  serialize: () => new Uint8Array(),
  safe_serialize: () => new Uint8Array(),
};

// Setup fetch mock for http://localhost:3001/verify
// Simulates verification of zk proof
// Returns {ctHash: stringified value, signature: `${account_addr}-${security_zone}-${chain_id}-`, recid: 0}
// Expects the proof to be created by the MockZkListBuilder `build_with_proof_packed` above
const mockFetch = vi.fn();
global.fetch = mockFetch;
const setupZkVerifyMock = () => {
  mockFetch.mockImplementation((url: string, options: any) => {
    if (url === `${MockZkVerifierUrl}/verify`) {
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

// Create a test keysStorage instance (non-persisted for tests)
let keysStorage: KeysStorage;

const insertMockKeys = (chainId: number, securityZone: number) => {
  keysStorage.setFheKey(chainId, securityZone, '0x1234567890');
  keysStorage.setCrs(chainId, '0x1234567890');
};

const mockTfhePublicKeyDeserializer: FheKeyDeserializer = (buff: string) => {
  return buff;
};

const mockCompactPkeCrsDeserializer: FheKeyDeserializer = (buff: string) => {
  return buff;
};

const mockInitTfhe: TfheInitializer = () => {
  return Promise.resolve(true);
};

const mockZkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator = (fhe: string, crs: string) => {
  return {
    zkBuilder: new MockZkListBuilder(),
    zkCrs: MockCrs,
  };
};

const createMockCofhesdkConfig = (chainId: number, zkVerifierUrl: string) => {
  return createCofhesdkConfigBase({
    supportedChains: [
      {
        id: chainId,
        name: 'Mock Chain',
        network: 'Mock Network',
        coFheUrl: MockZkVerifierUrl,
        thresholdNetworkUrl: MockZkVerifierUrl,
        environment: 'TESTNET',
        verifierUrl: zkVerifierUrl,
      },
    ],
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

describe('EncryptInputsBuilder', () => {
  const defaultSender = '0x1234567890123456789012345678901234567890';
  const defaultChainId = 1;
  const createDefaultParams = () => {
    return {
      inputs: [Encryptable.uint128(100n)] as [EncryptableUint128],
      account: defaultSender,
      chainId: defaultChainId,

      config: createMockCofhesdkConfig(defaultChainId, MockZkVerifierUrl),
      publicClient: publicClient,
      walletClient: bobWalletClient,

      tfhePublicKeyDeserializer: mockTfhePublicKeyDeserializer,
      compactPkeCrsDeserializer: mockCompactPkeCrsDeserializer,
      zkBuilderAndCrsGenerator: mockZkBuilderAndCrsGenerator,
      initTfhe: mockInitTfhe,
      zkProveWorkerFn: undefined,
      keysStorage: keysStorage,
      requireConnected: vi.fn(),
    };
  };

  let builder: EncryptInputsBuilder<[EncryptableUint128]>;

  beforeEach(() => {
    // Create a fresh keysStorage instance for each test (non-persisted)
    keysStorage = createKeysStore(null);
    setupZkVerifyMock();
    insertMockKeys(defaultChainId, 0);
    builder = new EncryptInputsBuilder(createDefaultParams());
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

    it('should throw an error if config is not set', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        config: undefined as unknown as CofhesdkConfig,
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.MissingConfig);
    });

    it('should throw an error if tfhePublicKeyDeserializer is not set', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        tfhePublicKeyDeserializer: undefined as unknown as FheKeyDeserializer,
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.MissingTfhePublicKeyDeserializer);
    });

    it('should throw an error if compactPkeCrsDeserializer is not set', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        compactPkeCrsDeserializer: undefined as unknown as FheKeyDeserializer,
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.MissingCompactPkeCrsDeserializer);
    });

    it('should throw an error if initTfhe throws an error', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        initTfhe: vi.fn().mockRejectedValue(new Error('Failed to initialize TFHE')),
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.InitTfheFailed);
    });

    it('should throw an error if initTfhe throws', async () => {
      const mockInitTfhe = vi.fn().mockRejectedValue(new Error('Failed to initialize TFHE'));
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        initTfhe: mockInitTfhe,
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.InitTfheFailed);
    });

    it('should not throw an error if initTfhe is set', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        initTfhe: mockInitTfhe,
      });
      const result = await builder.encrypt();
      expectResultSuccess(result);
    });
  });

  describe('sender', () => {
    it('should set sender and return builder for chaining', () => {
      const sender = '0x9876543210987654321098765432109876543210';

      const result = builder.setAccount(sender);

      expect(result).toBe(builder);
      expect(result.getAccount()).toBe(sender);
    });

    it('should allow chaining with other methods', () => {
      const sender = '0x1111111111111111111111111111111111111111';
      const securityZone = 5;

      const result = builder
        .setAccount(sender)
        .setSecurityZone(securityZone)
        .setStepCallback(() => {});

      expect(result).toBe(builder);
      expect(result.getAccount()).toBe(sender);
      expect(result.getSecurityZone()).toBe(securityZone);
    });

    it('should throw an error if account is not set', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        account: undefined,
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.AccountUninitialized);
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
        .setAccount(sender)
        .setStepCallback(() => {});

      expect(result).toBe(builder);
      expect(result.getAccount()).toBe(sender);
      expect(result.getSecurityZone()).toBe(securityZone);
    });
  });

  describe('chainId', () => {
    it('should set chain id and return builder for chaining', () => {
      const chainId = 2;
      const result = builder.setChainId(chainId);
      expect(result).toBe(builder);
      expect(result.getChainId()).toBe(chainId);
    });

    it('should throw an error if chainId is not set', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        chainId: undefined,
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.ChainIdUninitialized);
    });
  });

  describe('zkVerifierUrl', () => {
    it('should throw if zkVerifierUrl is not set', async () => {
      builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        inputs: [Encryptable.uint128(100n)] as [EncryptableUint128],
        account: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        config: createMockCofhesdkConfig(defaultChainId, undefined as unknown as string),
      });

      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.ZkVerifierUrlUninitialized);
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
      expect(stepCallback).toHaveBeenCalledTimes(10);

      expect(stepCallback).toHaveBeenNthCalledWith(
        1,
        EncryptStep.InitTfhe,
        expect.objectContaining({
          isStart: true,
          isEnd: false,
          duration: 0,
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        2,
        EncryptStep.InitTfhe,
        expect.objectContaining({
          isStart: false,
          isEnd: true,
          duration: expect.any(Number),
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        3,
        EncryptStep.FetchKeys,
        expect.objectContaining({
          isStart: true,
          isEnd: false,
          duration: 0,
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        4,
        EncryptStep.FetchKeys,
        expect.objectContaining({
          isStart: false,
          isEnd: true,
          duration: expect.any(Number),
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        5,
        EncryptStep.Pack,
        expect.objectContaining({
          isStart: true,
          isEnd: false,
          duration: 0,
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        6,
        EncryptStep.Pack,
        expect.objectContaining({
          isStart: false,
          isEnd: true,
          duration: expect.any(Number),
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        7,
        EncryptStep.Prove,
        expect.objectContaining({
          isStart: true,
          isEnd: false,
          duration: 0,
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        8,
        EncryptStep.Prove,
        expect.objectContaining({
          isStart: false,
          isEnd: true,
          duration: expect.any(Number),
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        9,
        EncryptStep.Verify,
        expect.objectContaining({
          isStart: true,
          isEnd: false,
          duration: 0,
        })
      );
      expect(stepCallback).toHaveBeenNthCalledWith(
        10,
        EncryptStep.Verify,
        expect.objectContaining({
          isStart: false,
          isEnd: true,
          duration: expect.any(Number),
        })
      );

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

    it('should use overridden account when set', async () => {
      const overriddenSender = '0x5555555555555555555555555555555555555555';
      builder.setAccount(overriddenSender);

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

      insertMockKeys(defaultChainId, overriddenZone);

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

    it('should throw an error if total bits exceeds 2048', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        inputs: [
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
          Encryptable.uint128(100n),
        ],
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.ZkPackFailed);
    });

    it('should throw an error if utype is invalid', async () => {
      const builder = new EncryptInputsBuilder({
        ...createDefaultParams(),
        inputs: [
          {
            data: 10n,
            utype: FheTypes.Uint10, // Invalid utype
          },
        ] as unknown as [EncryptableItem],
      });
      const result = await builder.encrypt();
      expectResultError(result, CofhesdkErrorCode.ZkPackFailed);
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

      insertMockKeys(defaultChainId, securityZone);

      const stepCallback = vi.fn();
      const result = await builder
        .setAccount(sender)
        .setSecurityZone(securityZone)
        .setStepCallback(stepCallback)
        .encrypt();
      const resultData = expectResultSuccess(result);

      expect(result).toBeDefined();
      expect(stepCallback).toHaveBeenCalledTimes(10);

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

      insertMockKeys(defaultChainId, securityZone);

      builder.setAccount(sender);
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
