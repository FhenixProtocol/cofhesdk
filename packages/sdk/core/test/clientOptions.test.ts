import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCofheClientBase } from '../client';
import { type CofheClient } from '../clientTypes';
import { createCofheConfigBase } from '../config';
import { CofheErrorCode } from '../error';
import { EncryptInputsBuilder } from '../encrypt/encryptInputsBuilder';
import { DecryptForViewBuilder } from '../decrypt/decryptForViewBuilder';
import { DecryptForTxBuilder } from '../decrypt/decryptForTxBuilder';
import { Encryptable, FheTypes } from '../types';
import { createCofheClient as rootCreateCofheClient, createCofheConfig as rootCreateCofheConfig } from '../index';

vi.mock('../keyStore', () => ({
  createKeysStore: vi.fn(() => ({
    rehydrateKeysStore: vi.fn().mockResolvedValue(undefined),
    getFheKey: vi.fn(),
    getCrs: vi.fn(),
    setFheKey: vi.fn(),
    setCrs: vi.fn(),
    clearKeysStorage: vi.fn(),
    store: {} as any,
  })),
}));

const CONTRACT = '0x1111111111111111111111111111111111111111';
const ACCOUNT = '0x2222222222222222222222222222222222222222';
const ACP_HASH = '0xabc123';

const connect = (client: CofheClient) =>
  client.connect(
    { getChainId: vi.fn().mockResolvedValue(11155111) } as any,
    { account: { address: ACCOUNT, type: 'json-rpc' } } as any
  );

const createTestClient = (): CofheClient =>
  createCofheClientBase({
    config: createCofheConfigBase({ supportedChains: [] }),
    zkBuilderAndCrsGenerator: {} as any,
    tfhePublicKeyDeserializer: {} as any,
    compactPkeCrsDeserializer: {} as any,
    initTfhe: () => Promise.resolve(false),
  });

/** The builder `execute()` ran on, i.e. the state the options were turned into. */
const executedOn = (spy: { mock: { instances: unknown[] } }) => spy.mock.instances[0] as any;

describe('client options-object forms', () => {
  let client: CofheClient;

  beforeEach(async () => {
    client = createTestClient();
    await connect(client);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('encryptInputs(inputs, options)', () => {
    it('runs the encryption and resolves to the builder result', async () => {
      const result = ['0xhash', '0xsignature'];
      const execute = vi.spyOn(EncryptInputsBuilder.prototype, 'execute').mockResolvedValue(result as any);
      const onStep = vi.fn();

      const promise = client.encryptInputs([Encryptable.uint64(1n)], {
        consumingContract: CONTRACT,
        account: ACCOUNT,
        chainId: 421614,
        securityZone: 2,
        useWorker: false,
        onStep,
      });

      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.toBe(result);

      const builder = executedOn(execute);
      expect(builder.getConsumingContract()).toBe(CONTRACT);
      expect(builder.getAccount()).toBe(ACCOUNT);
      expect(builder.getChainId()).toBe(421614);
      expect(builder.getSecurityZone()).toBe(2);
      expect(builder.getUseWorker()).toBe(false);
      expect(builder.getStepCallback()).toBe(onStep);
    });

    it('leaves unset options at the builder defaults', async () => {
      const execute = vi.spyOn(EncryptInputsBuilder.prototype, 'execute').mockResolvedValue([] as any);

      await client.encryptInputs([Encryptable.uint64(1n)], { consumingContract: CONTRACT });

      const builder = executedOn(execute);
      expect(builder.getSecurityZone()).toBe(0);
      expect(builder.getStepCallback()).toBeUndefined();
    });

    it('rejects with CONSUMING_CONTRACT_UNINITIALIZED when the option is missing', async () => {
      await expect(client.encryptInputs([Encryptable.uint64(1n)], {} as any)).rejects.toMatchObject({
        code: CofheErrorCode.ConsumingContractUninitialized,
        hint: expect.stringContaining('consumingContract'),
      });
    });

    it('rejects with NOT_CONNECTED instead of throwing before connect', async () => {
      const promise = createTestClient().encryptInputs([Encryptable.uint64(1n)], { consumingContract: CONTRACT });

      await expect(promise).rejects.toMatchObject({ code: CofheErrorCode.NotConnected });
    });

    it('still returns the builder without options', () => {
      const execute = vi.spyOn(EncryptInputsBuilder.prototype, 'execute');

      expect(client.encryptInputs([Encryptable.uint64(1n)])).toBeInstanceOf(EncryptInputsBuilder);
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe('decryptForView(ctHash, utype, options)', () => {
    it('runs with the defaults for an empty options object', async () => {
      const execute = vi.spyOn(DecryptForViewBuilder.prototype, 'execute').mockResolvedValue(42n as any);
      const withACP = vi.spyOn(DecryptForViewBuilder.prototype, 'withACP');

      await expect(client.decryptForView(7n, FheTypes.Uint64, {})).resolves.toBe(42n);

      expect(execute).toHaveBeenCalledTimes(1);
      expect(withACP).not.toHaveBeenCalled();
    });

    it('accepts a type name in place of the FheTypes member', async () => {
      const execute = vi.spyOn(DecryptForViewBuilder.prototype, 'execute').mockResolvedValue(true as any);

      await client.decryptForView(7n, 'bool', {});
      expect(executedOn(execute).utype).toBe(FheTypes.Bool);

      const builder = client.decryptForView(7n, 'address');
      expect(builder).toBeInstanceOf(DecryptForViewBuilder);
      expect((builder as any).utype).toBe(FheTypes.Uint160);
    });

    it('forwards the options to the builder', async () => {
      const execute = vi.spyOn(DecryptForViewBuilder.prototype, 'execute').mockResolvedValue(1n as any);
      const onPoll = vi.fn();

      await client.decryptForView(7n, 'uint32', {
        acp: ACP_HASH,
        chainId: 421614,
        account: ACCOUNT,
        onPoll,
        accessDeniedRetryTimeout: 5000,
      });

      const builder = executedOn(execute);
      expect(builder.getACPHash()).toBe(ACP_HASH);
      expect(builder.getChainId()).toBe(421614);
      expect(builder.getAccount()).toBe(ACCOUNT);
      expect(builder.pollCallback).toBe(onPoll);
      expect(builder.accessDeniedRetryTimeoutMs).toBe(5000);
    });

    it("treats acp: 'active' as the default", async () => {
      vi.spyOn(DecryptForViewBuilder.prototype, 'execute').mockResolvedValue(1n as any);
      const withACP = vi.spyOn(DecryptForViewBuilder.prototype, 'withACP');

      await client.decryptForView(7n, 'uint32', { acp: 'active' });

      expect(withACP).not.toHaveBeenCalled();
    });

    it('rejects an unknown type name with INVALID_ARGUMENT and the supported names', async () => {
      await expect(client.decryptForView(7n, 'uint256' as any, {})).rejects.toMatchObject({
        code: CofheErrorCode.InvalidArgument,
        hint: expect.stringContaining('uint64'),
      });
    });

    it('rejects instead of throwing for an invalid option value', async () => {
      const promise = client.decryptForView(7n, 'uint32', { accessDeniedRetryTimeout: -1 });

      await expect(promise).rejects.toMatchObject({ code: CofheErrorCode.InvalidArgument });
    });
  });

  describe('decryptForTx(ctHash, options)', () => {
    const txResult = { ctHash: 7n, decryptedValue: 42n, signature: '0xsig' as const };

    it("acp: 'none' decrypts without an ACP", async () => {
      const execute = vi.spyOn(DecryptForTxBuilder.prototype, 'execute').mockResolvedValue(txResult);
      const withoutACP = vi.spyOn(DecryptForTxBuilder.prototype, 'withoutACP');
      const withACP = vi.spyOn(DecryptForTxBuilder.prototype, 'withACP');

      await expect(client.decryptForTx(7n, { acp: 'none' })).resolves.toBe(txResult);

      expect(withoutACP).toHaveBeenCalledTimes(1);
      expect(withACP).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("acp: 'active' uses the active ACP", async () => {
      vi.spyOn(DecryptForTxBuilder.prototype, 'execute').mockResolvedValue(txResult);
      const withACP = vi.spyOn(DecryptForTxBuilder.prototype, 'withACP');

      await client.decryptForTx(7n, { acp: 'active' });

      expect(withACP).toHaveBeenCalledWith();
    });

    it('an ACP hash selects that ACP and the other options are forwarded', async () => {
      const execute = vi.spyOn(DecryptForTxBuilder.prototype, 'execute').mockResolvedValue(txResult);

      await client.decryptForTx(7n, { acp: ACP_HASH, chainId: 421614, account: ACCOUNT });

      const builder = executedOn(execute);
      expect(builder.getACPHash()).toBe(ACP_HASH);
      expect(builder.getChainId()).toBe(421614);
      expect(builder.getAccount()).toBe(ACCOUNT);
    });

    it('rejects with INVALID_ARGUMENT naming the choices when acp is missing', async () => {
      const execute = vi.spyOn(DecryptForTxBuilder.prototype, 'execute');

      await expect(client.decryptForTx(7n, {} as any)).rejects.toMatchObject({
        code: CofheErrorCode.InvalidArgument,
        hint: expect.stringContaining("acp: 'none'"),
      });
      expect(execute).not.toHaveBeenCalled();
    });

    it('still returns the builder without options', () => {
      expect(client.decryptForTx(7n)).toBeInstanceOf(DecryptForTxBuilder);
    });
  });
});

describe("platform functions imported from '@cofhe/sdk'", () => {
  it.each([
    ['createCofheClient', rootCreateCofheClient],
    ['createCofheConfig', rootCreateCofheConfig],
  ] as const)('%s throws WRONG_ENTRYPOINT naming both entrypoints', (name, stub) => {
    try {
      (stub as (config: unknown) => never)({ supportedChains: [] });
      expect.fail('Expected error');
    } catch (error) {
      expect(error).toMatchObject({ code: CofheErrorCode.WrongEntrypoint, context: { name } });
      expect((error as any).hint).toContain('@cofhe/sdk/node');
      expect((error as any).hint).toContain('@cofhe/sdk/web');
    }
  });
});
