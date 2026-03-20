import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { Encryptable, FheTypes } from '@cofhe/sdk';

describe('Decrypt', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const storeEncrypted = async (enc: { ctHash: bigint; securityZone: number; utype: number; signature: string }) => {
    await walletClient.writeContract({
      ...cofhe.mocks.TestBed,
      functionName: 'setNumber',
      args: [{ ctHash: enc.ctHash, securityZone: enc.securityZone, utype: enc.utype, signature: enc.signature as `0x${string}` }],
    });
    return publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    }) as Promise<`0x${string}`>;
  };

  describe('For View', async () => {
    it('decrypts an encrypted value stored on-chain', async () => {
      const client = await cofhe.createClientWithBatteries(walletClient);
      const [enc] = await client.encryptInputs([Encryptable.uint32(99n)]).execute();
      const ctHash = await storeEncrypted(enc);

      const decrypted = await client.decryptForView(ctHash, FheTypes.Uint32).execute();
      assert.equal(decrypted, 99n);
    });
  });

  describe('For Tx', async () => {
    it('decrypts on-chain and publishes the result via TestBed', async () => {
      const testValue = 77n;
      const client = await cofhe.createClientWithBatteries(walletClient);
      const [enc] = await client.encryptInputs([Encryptable.uint32(testValue)]).execute();
      const ctHash = await storeEncrypted(enc);

      const result = await client.decryptForTx(ctHash).withPermit().execute();
      assert.equal(result.decryptedValue, testValue);
      assert.equal(typeof result.signature, 'string');

      await walletClient.writeContract({
        ...cofhe.mocks.TestBed,
        functionName: 'publishDecryptResult',
        args: [ctHash, result.decryptedValue, result.signature as `0x${string}`],
      });

      const [publishedValue, isDecrypted] = await publicClient.readContract({
        ...cofhe.mocks.TestBed,
        functionName: 'getDecryptResultSafe',
        args: [ctHash],
      }) as [bigint, boolean];

      assert.equal(isDecrypted, true);
      assert.equal(Number(publishedValue), Number(testValue));
    });
  });
});
