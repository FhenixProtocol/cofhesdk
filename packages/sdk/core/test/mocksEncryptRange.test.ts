import { describe, it, expect, vi } from 'vitest';
import { type PublicClient, type WalletClient } from 'viem';
import { hardhat } from 'viem/chains';
import { EncryptInputsBuilder } from '../encrypt/encryptInputsBuilder.js';
import { Encryptable, FheTypes, type EncryptableItem } from '../types.js';
import { createCofheConfigBase } from '../config.js';
import { zkPack, type ZkCiphertextListBuilder } from '../encrypt/zkPackProveVerify.js';

// The hardhat (mocks) encrypt path must reject the same out-of-range plaintexts that the
// production path rejects in zkPack. Otherwise MockCoFHE._set masks the value with the utype
// mask (e.g. uint8(256) -> 0) and tests pass on hardhat while the same call throws on a real chain.

const account = '0x1234567890123456789012345678901234567890';
const consumingContract = '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';

const fakeClients = () => {
  const readContract = vi.fn(async ({ args }: any) => (args[0] as bigint[]).map((_, i) => BigInt(i + 1)));
  const writeContract = vi.fn(async () => '0x' as `0x${string}`);
  const publicClient = { readContract } as unknown as PublicClient;
  const walletClient = { account: { address: account }, writeContract } as unknown as WalletClient;
  return { publicClient, walletClient, readContract, writeContract };
};

const mocksBuilder = (inputs: EncryptableItem[]) => {
  const { publicClient, walletClient, readContract, writeContract } = fakeClients();
  const builder = new EncryptInputsBuilder({
    inputs: inputs as any,
    account,
    chainId: hardhat.id,
    config: createCofheConfigBase({ supportedChains: [], mocks: { encryptDelay: 0 } }),
    publicClient,
    walletClient,
    zkvWalletClient: walletClient,
    tfhePublicKeyDeserializer: vi.fn(),
    compactPkeCrsDeserializer: vi.fn(),
    zkBuilderAndCrsGenerator: vi.fn() as any,
    initTfhe: undefined,
    zkProveWorkerFn: undefined,
    keysStorage: undefined,
    requireConnected: vi.fn(),
  });
  builder.setConsumingContract(consumingContract);
  return { builder, readContract, writeContract };
};

const noop = () => undefined;
const noopZkBuilder = {
  push_boolean: noop,
  push_u8: noop,
  push_u16: noop,
  push_u32: noop,
  push_u64: noop,
  push_u128: noop,
  push_u160: noop,
  build_with_proof_packed: noop,
} as unknown as ZkCiphertextListBuilder;

const outOfRange: [string, EncryptableItem][] = [
  ['uint8(256)', Encryptable.uint8(256n)],
  ['uint16(65536)', Encryptable.uint16(65536n)],
  ['uint32(2^32)', Encryptable.uint32(2n ** 32n)],
  ['uint64(2^64)', Encryptable.uint64(2n ** 64n)],
  ['uint128(2^128)', Encryptable.uint128(2n ** 128n)],
  ['address(2^160)', { data: 2n ** 160n, securityZone: 0, utype: FheTypes.Uint160 } as EncryptableItem],
];

describe('mocks encrypt path value range parity', () => {
  it.each(outOfRange)('production zkPack rejects %s', (_, item) => {
    expect(() => zkPack([item], noopZkBuilder)).toThrow(/out of range/);
  });

  it.each(outOfRange)('hardhat mocks encrypt rejects %s before touching the chain', async (_, item) => {
    const { builder, readContract, writeContract } = mocksBuilder([item]);
    await expect(builder.execute()).rejects.toThrow(/out of range/);
    expect(readContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it('hardhat mocks encrypt still accepts the max value of each type', async () => {
    const { builder, writeContract } = mocksBuilder([
      Encryptable.uint8(255n),
      Encryptable.uint16(65535n),
      Encryptable.uint32(2n ** 32n - 1n),
      Encryptable.uint64(2n ** 64n - 1n),
      Encryptable.bool(true),
    ]);
    await expect(builder.execute()).resolves.toBeDefined();
    expect(writeContract).toHaveBeenCalledTimes(1);
  });
});
