import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { Encryptable, FheTypes } from '@cofhe/sdk';

describe('Integration – Hardhat', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  it('full flow: encrypt → store on-chain → decryptForView', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    const [enc] = await client.encryptInputs([Encryptable.uint32(100n)]).execute();

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

    const ctHash = (await publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    })) as `0x${string}`;

    const decrypted = await client.decryptForView(ctHash, FheTypes.Uint32).execute();
    assert.equal(decrypted, 100n);
  });

  it('full flow: encrypt → store on-chain → decryptForTx → publish', async () => {
    const testValue = 55n;
    const client = await cofhe.createClientWithBatteries(walletClient);
    const [enc] = await client.encryptInputs([Encryptable.uint32(testValue)]).execute();

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

    const ctHash = (await publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    })) as `0x${string}`;

    const result = await client.decryptForTx(ctHash).withPermit().execute();
    assert.equal(result.decryptedValue, testValue);

    await walletClient.writeContract({
      ...cofhe.mocks.TestBed,
      functionName: 'publishDecryptResult',
      args: [ctHash, Number(result.decryptedValue), result.signature as `0x${string}`],
    });

    const [publishedValue, isDecrypted] = await publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'getDecryptResultSafe',
      args: [ctHash],
    });

    assert.equal(isDecrypted, true);
    assert.equal(Number(publishedValue), Number(testValue));
  });

  it('trivial value: setNumberTrivial → getPlaintext → verify', async () => {
    await walletClient.writeContract({
      ...cofhe.mocks.TestBed,
      functionName: 'setNumberTrivial',
      args: [42],
    });

    const ctHash = (await publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    })) as `0x${string}`;

    const plaintext = await cofhe.mocks.getPlaintext(ctHash);
    assert.equal(plaintext, 42n);
  });
});
