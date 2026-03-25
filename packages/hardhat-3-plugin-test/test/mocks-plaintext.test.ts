import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

describe('Mocks Plaintext', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const setTrivialNumber = async (value: number) => {
    await walletClient.writeContract({
      ...cofhe.mocks.TestBed,
      functionName: 'setNumberTrivial',
      args: [value],
    });
  };

  const getCtHash = () =>
    publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    }) as Promise<`0x${string}`>;

  beforeEach(async () => {
    await setTrivialNumber(7);
  });

  it('getPlaintext returns the stored trivial value', async () => {
    const ctHash = await getCtHash();
    const plaintext = await cofhe.mocks.getPlaintext(ctHash);
    assert.equal(plaintext, 7n);
  });

  it('expectPlaintext passes for the correct value', async () => {
    const ctHash = await getCtHash();
    await cofhe.mocks.expectPlaintext(ctHash, 7n);
  });

  it('expectPlaintext throws for a wrong value', async () => {
    const ctHash = await getCtHash();
    await assert.rejects(() => cofhe.mocks.expectPlaintext(ctHash, 99n), /expected/);
  });
});
