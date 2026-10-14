import hre from 'hardhat';
import { expect } from 'chai';
import type { Contract } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { signedSelfPermission, latestTimestamp, advanceTime } from './helpers/acp';

/**
 * ACP default validator — timestamp-based revocation.
 *
 * Truth table of `disabled(issuer, id)` (id = acp creation timestamp):
 *
 *   | condition                   | result |
 *   |-----------------------------|--------|
 *   | id > block.timestamp        | true   |  future-dated → never valid
 *   | id <= revokeAllAt[issuer]   | true   |  mass revocation (inclusive)
 *   | revokedSingle[issuer][id]   | true   |  targeted revocation
 *   | otherwise                   | false  |
 *
 * Plus the full-stack flows through MockACP.checkPermissionValidity.
 */

describe('ACP default validator (timestamp-based revocation)', () => {
  let acp: Contract;
  let issuer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  before(async () => {
    [issuer, other] = await hre.ethers.getSigners();
    acp = await (await hre.ethers.getContractFactory('MockACL')).deploy();
    await acp.waitForDeployment();
  });

  // fresh validator per test — revocation state must not leak between scenarios
  let validator: Contract;
  beforeEach(async () => {
    validator = await (await hre.ethers.getContractFactory('ACPTimestampRevoker')).deploy();
    await validator.waitForDeployment();
  });

  // ---------------------------------------------------- disabled() truth table

  describe('disabled() truth table', () => {
    it('fresh id (creation = now) — not disabled', async () => {
      const now = await latestTimestamp();
      expect(await validator.disabled(issuer.address, now)).to.equal(false);
    });

    it('future-dated id — disabled', async () => {
      const now = await latestTimestamp();
      expect(await validator.disabled(issuer.address, now + 3600n)).to.equal(true);
    });

    it('revokeSingle disables exactly that id', async () => {
      const now = await latestTimestamp();
      await validator.connect(issuer).revokeSingle(now - 100n);
      expect(await validator.disabled(issuer.address, now - 100n)).to.equal(true);
      expect(await validator.disabled(issuer.address, now - 99n)).to.equal(false);
    });

    it('revocations are per-issuer: revoking my id does not affect another issuer', async () => {
      const now = await latestTimestamp();
      await validator.connect(other).revokeSingle(now - 100n);
      expect(await validator.disabled(other.address, now - 100n)).to.equal(true);
      expect(await validator.disabled(issuer.address, now - 100n)).to.equal(false);
    });

    it('revokeAllExisting disables ids at and before the threshold (inclusive)', async () => {
      await validator.connect(issuer).revokeAllExisting();
      const threshold = await validator.revokeAllAt(issuer.address);
      expect(await validator.disabled(issuer.address, threshold - 50n)).to.equal(true);
      expect(await validator.disabled(issuer.address, threshold)).to.equal(true); // boundary: same-second → revoked
    });

    it('ids after a revoke-all remain valid (new acps work)', async () => {
      await validator.connect(issuer).revokeAllExisting();
      const threshold = await validator.revokeAllAt(issuer.address);
      await advanceTime(60);
      const newId = await latestTimestamp();
      expect(newId > threshold).to.equal(true);
      expect(await validator.disabled(issuer.address, newId)).to.equal(false);
    });

    it('emits RevokedSingle / RevokedAll', async () => {
      const now = await latestTimestamp();
      await expect(validator.connect(issuer).revokeSingle(now))
        .to.emit(validator, 'RevokedSingle')
        .withArgs(issuer.address, now);
      await expect(validator.connect(issuer).revokeAllExisting()).to.emit(validator, 'RevokedAll');
    });
  });

  // ------------------------------------------------- full stack (via MockACP)

  describe('full stack: acp lifecycle through MockACP', () => {
    const revocablePermission = async (signer: HardhatEthersSigner = issuer) => {
      const createdAt = await latestTimestamp();
      return {
        createdAt,
        permission: await signedSelfPermission(acp, signer, {
          revokerData: createdAt,
          revokerContract: await validator.getAddress(),
        }),
      };
    };

    it('default acp (revokerData = creation timestamp) is valid from birth', async () => {
      const { permission } = await revocablePermission();
      expect(await acp.checkPermissionValidity(permission)).to.equal(true);
    });

    it('revokeSingle kills the acp', async () => {
      const { createdAt, permission } = await revocablePermission();
      expect(await acp.checkPermissionValidity(permission)).to.equal(true);
      await validator.connect(issuer).revokeSingle(createdAt);
      await expect(acp.checkPermissionValidity(permission)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_Disabled'
      );
    });

    it('revokeAllExisting kills old acps; an ACP created afterwards is valid', async () => {
      const { permission: oldPermission } = await revocablePermission();
      expect(await acp.checkPermissionValidity(oldPermission)).to.equal(true);

      await advanceTime(60);
      await validator.connect(issuer).revokeAllExisting();
      await expect(acp.checkPermissionValidity(oldPermission)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_Disabled'
      );

      await advanceTime(60);
      const { permission: newPermission } = await revocablePermission();
      expect(await acp.checkPermissionValidity(newPermission)).to.equal(true);
    });

    it('future-dated acp never validates (revoke-all dodge closed)', async () => {
      // attacker with temporary key access signs an ACP "created" far in the
      // future so it would survive a later revokeAllExisting — must be dead on arrival
      const farFuture = (await latestTimestamp()) + 365n * 24n * 3600n;
      const permission = await signedSelfPermission(acp, issuer, {
        revokerData: farFuture,
        revokerContract: await validator.getAddress(),
      });
      await expect(acp.checkPermissionValidity(permission)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_Disabled'
      );
    });

    it("a stranger's revocations cannot kill the issuer's acp", async () => {
      const { createdAt, permission } = await revocablePermission();
      await validator.connect(other).revokeSingle(createdAt);
      await validator.connect(other).revokeAllExisting();
      expect(await acp.checkPermissionValidity(permission)).to.equal(true);
    });
  });
});
