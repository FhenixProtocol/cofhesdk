import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { Encryptable } from '@cofhe/sdk';
import { toFunctionSelector } from 'viem';
import { getErrorText } from './helpers.js';

describe('Encrypt Inputs', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const invalidSignerSelector = toFunctionSelector('InvalidSigner(address,address)');
  const invalidSignatureSelector = toFunctionSelector('InvalidSignature()');

  const hashMaskForMetadata = (1n << 256n) - 1n - 0xffffn; // type(uint256).max - type(uint16).max

  const appendTaskManagerMetadata = (ctHash: bigint, utype: number, securityZone: number) => {
    const utypeMasked = BigInt(utype) & 0x7fn; // last 7 bits reserved for utype
    const securityZoneMasked = BigInt(securityZone) & 0xffn;
    return (ctHash & hashMaskForMetadata) | (utypeMasked << 8n) | securityZoneMasked;
  };

  const isSignatureMismatchError = (err: unknown) => {
    const message = getErrorText(err);
    return (
      message.includes(invalidSignerSelector) ||
      message.includes(invalidSignatureSelector) ||
      /InvalidSigner|InvalidSignature|unrecognized custom error/i.test(message)
    );
  };

  it('encrypts a uint32, stores on-chain, reads back ctHash', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    const [enc] = await client.encryptInputs([Encryptable.uint32(42n)]).execute();

    assert.equal(typeof enc.ctHash, 'bigint');
    assert.ok(enc.ctHash > 0n);
    assert.equal(typeof enc.signature, 'string');
    assert.match(enc.signature, /^0x[0-9a-f]*$/i);

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

    const storedHandle = BigInt(ctHash);
    const expectedHandle = appendTaskManagerMetadata(enc.ctHash, enc.utype, enc.securityZone);
    assert.equal(storedHandle, expectedHandle);
  });

  it('rejects storing an encrypted input if ctHash is tampered (signature mismatch)', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    const [enc] = await client.encryptInputs([Encryptable.uint32(42n)]).execute();

    await assert.rejects(
      () =>
        walletClient.writeContract({
          ...cofhe.mocks.TestBed,
          functionName: 'setNumber',
          args: [
            {
              ctHash: enc.ctHash + 1n,
              securityZone: enc.securityZone,
              utype: enc.utype,
              signature: enc.signature as `0x${string}`,
            },
          ],
        }),
      isSignatureMismatchError
    );
  });

  it('rejects storing an encrypted input if securityZone is tampered (signature mismatch)', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    const [enc] = await client.encryptInputs([Encryptable.uint32(42n)]).execute();

    // Important subtlety:
    // - `securityZone` is *validated* (must be within [0, 1] on mocks)
    // - but it's also part of the signed payload (ctHash, utype, securityZone, sender, chainId)
    // So even if we keep it within the valid range, changing it should break signature recovery.
    const tamperedSecurityZone = enc.securityZone === 0 ? 1 : 0;

    await assert.rejects(
      () =>
        walletClient.writeContract({
          ...cofhe.mocks.TestBed,
          functionName: 'setNumber',
          args: [
            {
              ctHash: enc.ctHash,
              securityZone: tamperedSecurityZone,
              utype: enc.utype,
              signature: enc.signature as `0x${string}`,
            },
          ],
        }),
      isSignatureMismatchError
    );
  });
});
