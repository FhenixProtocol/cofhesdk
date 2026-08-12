import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Encryptable, FheTypes } from '@cofhe/sdk';

const ALICE_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

describe('Inherited SDK Tests', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [bobWalletClient] = await viem.getWalletClients();
  const simpleTest = await viem.deployContract('SharedSimpleTest', [], {
    client: {
      public: publicClient,
      wallet: bobWalletClient,
    },
  });

  const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY);
  const aliceWalletClient = createWalletClient({
    account: aliceAccount,
    transport: http('http://127.0.0.1:8545'),
  });

  const storeEncrypted = async (client: Awaited<ReturnType<typeof cofhe.createClientWithBatteries>>, value: bigint) => {
    // [hash, signature] - one hash per input, followed by the shared batch signature.
    const [hash, signature] = await client
      .encryptInputs([Encryptable.uint32(value)])
      .setConsumingContract(simpleTest.address)
      .execute();
    await simpleTest.write.setValueBatch([[hash], signature]);
    const ctHash = await simpleTest.read.getValueHash();
    return { hash, signature, ctHash };
  };

  it('encrypt → store on-chain → read back ctHash', async () => {
    const client = await cofhe.createClientWithBatteries(bobWalletClient);
    const { hash, signature, ctHash } = await storeEncrypted(client, 42n);

    assert.equal(typeof hash, 'string');
    assert.match(hash, /^0x[0-9a-f]*$/i);
    assert.equal(typeof signature, 'string');
    assert.match(signature, /^0x[0-9a-f]*$/i);
    assert.equal(typeof ctHash, 'string');
    // The batch-verified hash is the same value stored/appended-metadata on-chain.
    assert.equal(hash, ctHash);
  });

  it('encrypt → store on-chain → decryptForView', async () => {
    const testValue = 100n;
    const client = await cofhe.createClientWithBatteries(bobWalletClient);
    const { ctHash } = await storeEncrypted(client, testValue);

    const decrypted = await client.decryptForView(ctHash, FheTypes.Uint32).execute();
    assert.equal(decrypted, testValue);
  });

  it('encrypt → store on-chain → decryptForTx → publish → verify', async () => {
    const testValue = 55n;
    const client = await cofhe.createClientWithBatteries(bobWalletClient);
    const { ctHash } = await storeEncrypted(client, testValue);

    const result = await client.decryptForTx(ctHash).withPermit().execute();
    assert.equal(result.decryptedValue, testValue);
    assert.equal(typeof result.signature, 'string');

    await simpleTest.write.publishDecryptResult([ctHash, Number(result.decryptedValue), result.signature]);

    const [publishedValue, isDecrypted] = await simpleTest.read.getDecryptResultSafe([ctHash]);

    assert.equal(isDecrypted, true);
    assert.equal(Number(publishedValue), Number(testValue));
  });

  it('self permit: create → verify active', async () => {
    const client = await cofhe.createClientWithBatteries(bobWalletClient);
    const [bobAddress] = await bobWalletClient.getAddresses();

    const permit = await client.acp.createSelf({
      issuer: bobAddress,
      name: 'Test Self Permit',
    });

    assert.ok(permit);
    assert.equal(permit.type, 'self');
    assert.equal(permit.name, 'Test Self Permit');
    assert.equal(permit.issuer.toLowerCase(), bobAddress.toLowerCase());
    assert.notEqual(permit.issuerSignature, '0x');
    assert.ok(permit.sealingPrivateKey);
    assert.ok(permit.sealingKey);

    const activePermit = client.acp.getActivePermit();
    assert.ok(activePermit);
    assert.equal(activePermit.hash, permit.hash);
  });

  it('sharing permit: create → export → import as recipient', async () => {
    const bobClient = await cofhe.createClientWithBatteries(bobWalletClient);
    const [bobAddress] = await bobWalletClient.getAddresses();
    const [aliceAddress] = await aliceWalletClient.getAddresses();

    const sharingPermit = await bobClient.acp.createSharing({
      issuer: bobAddress,
      recipient: aliceAddress,
      name: 'Test Sharing Permit',
    });

    assert.ok(sharingPermit);
    assert.equal(sharingPermit.type, 'sharing');
    assert.equal(sharingPermit.issuer.toLowerCase(), bobAddress.toLowerCase());
    assert.equal(sharingPermit.recipient!.toLowerCase(), aliceAddress.toLowerCase());
    assert.notEqual(sharingPermit.issuerSignature, '0x');

    const exported = bobClient.acp.export(sharingPermit);
    assert.ok(exported);
    const parsed = JSON.parse(exported);
    assert.equal(parsed.type, 'sharing');
    assert.equal(parsed.issuer.toLowerCase(), bobAddress.toLowerCase());
    assert.equal(parsed.recipient.toLowerCase(), aliceAddress.toLowerCase());
    assert.ok(parsed.issuerSignature);
    assert.equal(parsed.sealingPrivateKey, undefined);

    const aliceClient = await cofhe.createClientWithBatteries(aliceWalletClient);
    const importedPermit = await aliceClient.acp.importShared(exported);

    assert.ok(importedPermit);
    assert.equal(importedPermit.type, 'recipient');
    assert.equal(importedPermit.issuer.toLowerCase(), bobAddress.toLowerCase());
    assert.equal(importedPermit.recipient!.toLowerCase(), aliceAddress.toLowerCase());
    assert.notEqual(importedPermit.recipientSignature, '0x');
    assert.ok(importedPermit.sealingPrivateKey);
  });
});
