import hre from 'hardhat';
import { expect } from 'chai';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { TestBedArtifact } from '@cofhe/mock-contracts';
import { TEST_BED_ADDRESS } from '@cofhe/sdk';

async function storeEncrypted(enc: { ctHash: bigint; securityZone: number; utype: number; signature: string }) {
  const [account] = await hre.cofhe.walletClient.getAddresses();
  await hre.cofhe.walletClient.writeContract({
    address: TEST_BED_ADDRESS,
    abi: TestBedArtifact.abi,
    functionName: 'setNumber',
    args: [{ ctHash: enc.ctHash, securityZone: enc.securityZone, utype: enc.utype, signature: enc.signature as `0x${string}` }],
    account,
    chain: null,
  });
  // numberHash returns bytes32 — already the correct format for publishDecryptResult
  return hre.cofhe.publicClient.readContract({
    address: TEST_BED_ADDRESS,
    abi: TestBedArtifact.abi,
    functionName: 'numberHash',
  }) as Promise<`0x${string}`>;
}

describe('Decrypt For View', () => {
  it('decrypts an encrypted value stored on-chain', async () => {
    const client = await hre.cofhe.createClientWithBatteries();
    const [enc] = await client.encryptInputs([Encryptable.uint32(99n)]).execute();
    const ctHash = await storeEncrypted(enc);

    const decrypted = await client.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(decrypted).to.equal(99n);
  });
});

describe('Decrypt For Tx', () => {
  it('decrypts on-chain and publishes the result via TestBed', async () => {
    const testValue = 77n;
    const client = await hre.cofhe.createClientWithBatteries();
    const [enc] = await client.encryptInputs([Encryptable.uint32(testValue)]).execute();
    const ctHash = await storeEncrypted(enc);

    const result = await client.decryptForTx(ctHash).withPermit().execute();

    expect(result.decryptedValue).to.equal(testValue);
    expect(result.signature).to.be.a('string');

    const [account] = await hre.cofhe.walletClient.getAddresses();
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
});
