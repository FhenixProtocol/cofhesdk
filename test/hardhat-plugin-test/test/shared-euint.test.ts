/**
 * sharedEuint — contract-to-contract encrypted value movement.
 *
 * Covers the round trip, the four ways a claim is rejected, cross-transaction expiry, and
 * presenter substitution. The last one is paired: the attack must revert against a receiver that
 * follows the call-edge rule AND succeed against one that does not. Without the second case the
 * first assertion passes vacuously whenever the setup is subtly wrong.
 */

import hre from 'hardhat';
import { expect } from 'chai';

const BALANCE = 100n;
const OTHER_BALANCE = 777n;

async function deploy(name: string) {
  const factory = await hre.ethers.getContractFactory(name);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

async function expectRevertWith(promise: Promise<unknown>, errorName: string) {
  try {
    await promise;
    expect.fail(`Expected revert with ${errorName}`);
  } catch (err: any) {
    if (err?.message?.startsWith(`Expected revert with ${errorName}`)) throw err;
    expect(err.message).to.include(errorName);
  }
}

describe('sharedEuint', () => {
  let vault: any, token: any, unsafeToken: any, attacker: any;
  let vaultAddr: string, tokenAddr: string, unsafeAddr: string, attackerAddr: string;
  let user: string;

  beforeEach(async () => {
    const [owner] = await hre.ethers.getSigners();
    user = owner.address;

    vault = await deploy('SharedVault');
    token = await deploy('SharedToken');
    unsafeToken = await deploy('SharedTokenUnsafe');
    attacker = await deploy('SharedAttacker');

    vaultAddr = await vault.getAddress();
    tokenAddr = await token.getAddress();
    unsafeAddr = await unsafeToken.getAddress();
    attackerAddr = await attacker.getAddress();

    await vault.setBalance(user, BALANCE);
  });

  describe('round trip', () => {
    it('shares out, computes, and shares the result back', async () => {
      await vault.roundTrip(tokenAddr, user);

      // Token halved the shared amount and handed it back.
      await hre.cofhe.mocks.expectPlaintext(await vault.lastResultHandle(), BALANCE / 2n);

      // The token saw the vault as its counterparty, not the EOA that started the transaction.
      expect(await token.lastCreditedTo()).to.equal(vaultAddr);
    });

    it('the receiver gets the sharer’s handle, not a copy', async () => {
      await vault.roundTrip(tokenAddr, user);
      expect(await token.lastReceivedHandle()).to.equal(await vault.balanceHandle(user));
    });
  });

  describe('claims that must fail', () => {
    it('rejects a second receive of the same share (single use)', async () => {
      await expectRevertWith(vault.shareOnceReceiveTwice(tokenAddr, user), 'NotShared');
    });

    it('rejects a handle that was never shared', async () => {
      await expectRevertWith(vault.pullWithoutSharing(tokenAddr, user), 'NotShared');
    });

    it('rejects a claim by a contract the share was not directed at', async () => {
      await expectRevertWith(vault.shareToWrongReceiver(tokenAddr, unsafeAddr, user), 'NotShared');
    });

    it('rejects sharing a handle the sharer is not allowed on', async () => {
      const otherVault = await deploy('SharedVault');
      await otherVault.setBalance(user, OTHER_BALANCE);
      const foreign = await otherVault.balanceHandle(user);

      await expectRevertWith(vault.shareForeignHandle(tokenAddr, foreign), 'SenderNotAllowed');
    });

    it('does not carry a share across transactions', async () => {
      await vault.shareOnly(tokenAddr, user); // tx 1 — shared, never consumed
      await expectRevertWith(vault.pullWithoutSharing(tokenAddr, user), 'NotShared'); // tx 2
    });
  });

  describe('presenter substitution', () => {
    // The vault shares, its own call fails and is swallowed, and the slot stays live for the rest
    // of the transaction. The attacker then presents that dangling share as its own — two
    // sequential calls from a contract it controls, no reentrancy.

    it('reverts when the receiver follows the call-edge rule', async () => {
      await token.setRevertOnPullFrom(vaultAddr);

      try {
        await attacker.attack(vaultAddr, tokenAddr, user);
        expect.fail('Expected revert with UnexpectedSharer');
      } catch (err: any) {
        // Specifically the sharer/presenter mismatch — not NotShared (which would mean the slot
        // never dangled and the test proved nothing) and not ForcedRevert.
        expect(err.message).to.include('UnexpectedSharer');
        expect(err.message).to.include(attackerAddr); // expected: who presented it
        expect(err.message).to.include(vaultAddr); // actual: who shared it
      }

      // Nothing was credited to anyone.
      expect(await token.lastCreditedTo()).to.equal(hre.ethers.ZeroAddress);
    });

    it('succeeds when the receiver names a trusted sharer instead — the attack is real', async () => {
      await unsafeToken.setTrustedSharer(vaultAddr);
      await unsafeToken.setRevertOnPullFrom(vaultAddr);

      await attacker.attack(vaultAddr, unsafeAddr, user);

      // The dangling share was written by the vault, so naming the vault satisfies the check and
      // the attacker is credited with the victim's value.
      expect(await unsafeToken.lastCreditedTo()).to.equal(attackerAddr);
    });
  });
});
