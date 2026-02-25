import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { Wallet, keccak256, solidityPacked, toBeHex } from 'ethers';

// Minimal happy-path test for TestBed.publishDecryptResult
// This verifies we can publish a decrypt result with a valid signature and read it back.

describe('Decrypt With Proof Test', () => {
  it('Should publish decrypt result (happy path)', async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const taskManager = await hre.cofhe.mocks.getMockTaskManager();
    const testBed = await hre.cofhe.mocks.getTestBed();

    // Signer used by publishDecryptResult signature verification
    const signerPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const signerWallet = new Wallet(signerPrivateKey);

    await taskManager.setDecryptResultSigner(signerWallet.address);

    // ctHash layout: last 2 bytes are metadata
    // - byte 0: securityZone
    // - byte 1: utype
    // For uint32 TFHE, utype is 4 (Utils.EUINT32_TFHE)
    const securityZone = 0;
    const utype = 4;

    const base = BigInt(keccak256(solidityPacked(['string'], ['mock-ct-hash']))) & ~0xffffn;
    const ctHash = base | (BigInt(utype) << 8n) | BigInt(securityZone);

    const result = 424242n;

    const ctHashBytes32 = toBeHex(ctHash, 32);

    const digest = keccak256(
      solidityPacked(
        ['uint256', 'uint32', 'uint64', 'bytes32'],
        [result, utype, BigInt((await hre.ethers.provider.getNetwork()).chainId), ctHashBytes32]
      )
    );

    const sig = signerWallet.signingKey.sign(digest);
    const signature = hre.ethers.concat([sig.r, sig.s, hre.ethers.toBeHex(sig.v, 1)]);

    const tx = await testBed.publishDecryptResult(ctHashBytes32, result, signature);
    await tx.wait();

    const [value, decrypted] = await testBed.getDecryptResultSafe(ctHashBytes32);
    expect(decrypted).to.equal(true);
    expect(value).to.equal(result);
  });
});
