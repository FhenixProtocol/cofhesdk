import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { CofheErrorCode, Encryptable, FheTypes, isCofheError, type EncryptedItemInput } from '@cofhe/sdk';

describe('Decrypt', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const storeEncrypted = async (enc: EncryptedItemInput) => {
    await walletClient.writeContract({
      ...cofhe.mocks.TestBed,
      functionName: 'setNumber',
      args: [
        {
          ctHash: enc.ctHash,
          securityZone: enc.securityZone,
          utype: enc.utype,
          signature: enc.signature as `0x${string}`,
        },
      ],
    });
    return publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    });
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
        args: [ctHash, Number(result.decryptedValue), result.signature],
      });

      const [publishedValue, isDecrypted] = await publicClient.readContract({
        ...cofhe.mocks.TestBed,
        functionName: 'getDecryptResultSafe',
        args: [ctHash],
      });

      assert.equal(isDecrypted, true);
      assert.equal(Number(publishedValue), Number(testValue));
    });

    it('fails to decrypt withoutPermit() when ctHash is not globally allowed', async () => {
      const client = await cofhe.createClientWithBatteries(walletClient);
      const [enc] = await client.encryptInputs([Encryptable.uint32(123n)]).execute();
      const ctHash = await storeEncrypted(enc);

      await assert.rejects(client.decryptForTx(ctHash).withoutPermit().execute(), (err) => {
        assert.equal(isCofheError(err), true);
        if (isCofheError(err)) {
          assert.equal(err.code, CofheErrorCode.DecryptFailed);
          assert.match(err.message, /ACL Access Denied|NotAllowed|mocks decryptForTx call failed/i);
        }
        return true;
      });
    });

    it('fails to decrypt withPermit() when the active permit is expired', async () => {
      const client = await cofhe.createClientWithBatteries(walletClient);
      const [issuer] = await walletClient.getAddresses();
      assert.ok(issuer);

      const [enc] = await client.encryptInputs([Encryptable.uint32(123n)]).execute();
      const ctHash = await storeEncrypted(enc);

      // Overwrite the active permit with an intentionally expired one.
      await client.permits.createSelf({
        issuer,
        name: 'Expired Self Permit',
        expiration: 1,
      });

      await assert.rejects(client.decryptForTx(ctHash).withPermit().execute(), (err) => {
        assert.equal(isCofheError(err), true);
        if (isCofheError(err)) {
          assert.equal(err.code, CofheErrorCode.DecryptFailed);
          assert.match(err.message, /PermissionInvalid_Expired|expired|mocks decryptForTx call failed/i);
        }
        return true;
      });
    });
  });
});
