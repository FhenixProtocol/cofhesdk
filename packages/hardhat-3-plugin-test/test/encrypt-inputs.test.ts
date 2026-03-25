import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { Encryptable } from '@cofhe/sdk';

describe('Encrypt Inputs', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  it('encrypts a uint32, stores on-chain, reads back ctHash', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    const [enc] = await client.encryptInputs([Encryptable.uint32(42n)]).execute();

    assert.equal(typeof enc.ctHash, 'bigint');
    assert.ok(enc.ctHash > 0n);
    assert.equal(typeof enc.signature, 'string');

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

    const ctHash = await publicClient.readContract({
      ...cofhe.mocks.TestBed,
      functionName: 'numberHash',
    });

    assert.equal(typeof ctHash, 'string');
  });
});
