import hre from 'hardhat';
import { expect } from 'chai';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { TestBedArtifact } from '@cofhe/mock-contracts';
import { TEST_BED_ADDRESS } from '@cofhe/sdk';

describe('Integration – Hardhat', () => {
  it('full flow: encrypt → store on-chain → decryptForView', async () => {
    const client = await hre.cofhe.createClientWithBatteries();
    const [enc] = await client.encryptInputs([Encryptable.uint32(100n)]).execute();

    const [account] = await hre.cofhe.walletClient.getAddresses();
    await hre.cofhe.walletClient.writeContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'setNumber',
      args: [{ ctHash: enc.ctHash, securityZone: enc.securityZone, utype: enc.utype, signature: enc.signature as `0x${string}` }],
      account,
      chain: null,
    });

    const ctHash = await hre.cofhe.publicClient.readContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'numberHash',
    }) as `0x${string}`;

    const decrypted = await client.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(decrypted).to.equal(100n);
  });

  it('full flow: encrypt → store on-chain → decryptForTx → publish', async () => {
    const testValue = 55n;
    const client = await hre.cofhe.createClientWithBatteries();
    const [enc] = await client.encryptInputs([Encryptable.uint32(testValue)]).execute();

    const [account] = await hre.cofhe.walletClient.getAddresses();
    await hre.cofhe.walletClient.writeContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'setNumber',
      args: [{ ctHash: enc.ctHash, securityZone: enc.securityZone, utype: enc.utype, signature: enc.signature as `0x${string}` }],
      account,
      chain: null,
    });

    const ctHash = await hre.cofhe.publicClient.readContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'numberHash',
    }) as `0x${string}`;

    const result = await client.decryptForTx(ctHash).withPermit().execute();
    expect(result.decryptedValue).to.equal(testValue);

    // ctHash (bytes32) is the correct format for publishDecryptResult
    await hre.cofhe.walletClient.writeContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'publishDecryptResult',
      args: [ctHash, result.decryptedValue, result.signature as `0x${string}`],
      account,
      chain: null,
    });

    const [publishedValue, isDecrypted] = await hre.cofhe.publicClient.readContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'getDecryptResultSafe',
      args: [ctHash],
    }) as [bigint, boolean];

    // Viem returns uint32 as number, not bigint
    expect(isDecrypted).to.be.true;
    expect(Number(publishedValue)).to.equal(Number(testValue));
  });

  it('trivial value: setNumberTrivial → getPlaintext → verify', async () => {
    const [account] = await hre.cofhe.walletClient.getAddresses();
    await hre.cofhe.walletClient.writeContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'setNumberTrivial',
      args: [42],
      account,
      chain: null,
    });

    const ctHash = await hre.cofhe.publicClient.readContract({
      address: TEST_BED_ADDRESS,
      abi: TestBedArtifact.abi,
      functionName: 'numberHash',
    }) as `0x${string}`;

    const plaintext = await hre.cofhe.mocks.getPlaintext(ctHash);
    expect(plaintext).to.equal(42n);
  });
});
