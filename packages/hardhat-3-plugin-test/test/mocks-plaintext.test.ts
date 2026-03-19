import hre from 'hardhat';
import { expect } from 'chai';
import { TestBedArtifact } from '@cofhe/mock-contracts';
import { TEST_BED_ADDRESS } from '@cofhe/sdk';

async function setTrivialNumber(value: number) {
  const [account] = await hre.cofhe.walletClient.getAddresses();
  await hre.cofhe.walletClient.writeContract({
    address: TEST_BED_ADDRESS,
    abi: TestBedArtifact.abi,
    functionName: 'setNumberTrivial',
    args: [value],
    account,
    chain: null,
  });
}

async function getCtHash() {
  return hre.cofhe.publicClient.readContract({
    address: TEST_BED_ADDRESS,
    abi: TestBedArtifact.abi,
    functionName: 'numberHash',
  }) as Promise<`0x${string}`>;
}

describe('Mocks Plaintext', () => {
  beforeEach(async () => {
    await setTrivialNumber(7);
  });

  it('getPlaintext returns the stored trivial value', async () => {
    const ctHash = await getCtHash();
    const plaintext = await hre.cofhe.mocks.getPlaintext(ctHash);
    expect(plaintext).to.equal(7n);
  });

  it('expectPlaintext passes for the correct value', async () => {
    const ctHash = await getCtHash();
    await hre.cofhe.mocks.expectPlaintext(ctHash, 7n);
  });

  it('expectPlaintext throws for a wrong value', async () => {
    const ctHash = await getCtHash();
    try {
      await hre.cofhe.mocks.expectPlaintext(ctHash, 99n);
      expect.fail('expectPlaintext should have thrown');
    } catch (err) {
      expect((err as Error).message).to.include('expected');
    }
  });
});
