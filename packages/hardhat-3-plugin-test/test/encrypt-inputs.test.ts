import hre from 'hardhat';
import { expect } from 'chai';
import { Encryptable } from '@cofhe/sdk';
import { TestBedArtifact } from '@cofhe/mock-contracts';
import { TEST_BED_ADDRESS } from '@cofhe/sdk';

describe('Encrypt Inputs', () => {
  it('encrypts a uint32 value and stores it on-chain', async () => {
    const client = await hre.cofhe.createClientWithBatteries();

    const [enc] = await client.encryptInputs([Encryptable.uint32(42n)]).execute();

    expect(enc.ctHash).to.be.a('bigint');
    expect(enc.ctHash).to.be.greaterThan(0n);
    expect(enc.signature).to.be.a('string');

    // Verify it can be stored on-chain (TestBed.setNumber accepts an InEuint32 tuple)
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
    });

    expect(ctHash).to.be.a('string');
  });
});
