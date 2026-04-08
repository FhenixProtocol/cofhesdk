/**
 * Ensures that the deployed mock contracts are recognized correctly by the
 * hardhat 3 EDR. This ensures error messages are decoded and stack traces are
 * populated like so:
 *
 * ```
 * Error: VM Exception while processing transaction: reverted with custom error 'PermissionInvalid_Expired()'
 *         at MockACL.withPermission (npm/@cofhe/mock-contracts@local/contracts/Permissioned.sol:110)
 *         at MockACL.checkPermitValidity (npm/@cofhe/mock-contracts@local/contracts/MockACL.sol:317)
 * ```
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

const DUMMY_SIGNER = '0x0000000000000000000000000000000000000001' as const;

describe('Deployed Mocks — Error Recognition', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  // walletClients[0] is the owner (used during mock deployment); [1] is a non-owner.
  const [, nonOwnerWalletClient] = walletClients;

  it('readContract error message contains decoded error "PermissionInvalid_Expired"', async () => {
    const acl = cofhe.mocks.MockACL;

    const expiredPermission = {
      issuer: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      expiration: 0n,
      recipient: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      validatorId: 0n,
      validatorContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      sealingKey: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      issuerSignature: '0x' as `0x${string}`,
      recipientSignature: '0x' as `0x${string}`,
    };

    let err: any = null;
    try {
      await publicClient.readContract({
        ...acl,
        functionName: 'checkPermitValidity',
        args: [expiredPermission],
      });
    } catch (e) {
      err = e;
    }

    assert.ok(err !== null, 'Expected the call to revert');
    assert.ok(
      err.message.includes('PermissionInvalid_Expired'),
      `Expected "PermissionInvalid_Expired" in message, but got:\n${err.message}`
    );
  });

  it('writeContract error message contains decoded error "OnlyOwnerAllowed"', async () => {
    let err: any = null;
    try {
      await nonOwnerWalletClient.writeContract({
        ...cofhe.mocks.MockTaskManager,
        functionName: 'setVerifierSigner',
        args: [DUMMY_SIGNER],
      });
    } catch (e) {
      err = e;
    }

    assert.ok(err !== null, 'Expected the call to revert');
    assert.ok(
      err.message.includes('OnlyOwnerAllowed'),
      `Expected "OnlyOwnerAllowed" in message, but got:\n${err.message}`
    );
  });
});
