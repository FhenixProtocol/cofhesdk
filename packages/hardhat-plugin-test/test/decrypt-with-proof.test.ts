import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import { Wallet, keccak256, solidityPacked } from 'ethers';

// Minimal happy-path test for MockTaskManager.publishDecryptResult
// This verifies we can publish a decrypt result with a valid signature and read it back.

describe('Decrypt With Proof Test', () => {
  it('Should publish decrypt result (happy path)', async () => {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const taskManager = await hre.cofhe.mocks.getMockTaskManager();

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

    const digest = keccak256(
      solidityPacked(
        ['uint256', 'uint32', 'uint64', 'bytes32'],
        [result, utype, BigInt((await hre.ethers.provider.getNetwork()).chainId), hre.ethers.toBeHex(ctHash, 32)]
      )
    );

    const sig = signerWallet.signingKey.sign(digest);
    const signature = hre.ethers.concat([sig.r, sig.s, hre.ethers.toBeHex(sig.v, 1)]);

    await taskManager.publishDecryptResult(ctHash, result, signature);

    const onchain = await taskManager.getDecryptResult(ctHash);
    expect(onchain).to.equal(result);
  });
});
