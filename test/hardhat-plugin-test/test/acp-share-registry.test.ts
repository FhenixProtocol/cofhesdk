import hre from 'hardhat';
import { expect } from 'chai';
import type { Contract } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  ZERO_ADDRESS,
  ZERO_BYTES32,
  DEFAULT_SEALING_KEY,
  latestTimestamp,
  advanceTime,
  signedSharingPermission,
  type ACP,
} from './helpers/acp';

/**
 * ACPShareRegistry — the on-chain hand-off for sharing ACPs.
 *
 * The registry is a dumb store with three guarantees:
 *  - a listed share was posted by its claimed issuer (msg.sender check),
 *  - `sharesFor` returns only importable shares (unexpired, not revoked),
 *  - `isShareValid` is the same check exposed as a hook for contracts.
 */
describe('ACPShareRegistry', () => {
  let registry: Contract;
  let acl: Contract; // domain source for signing only
  let revoker: Contract;
  let bob: HardhatEthersSigner; // issuer
  let alice: HardhatEthersSigner; // recipient
  let carol: HardhatEthersSigner; // bystander

  const shareIdOf = async (p: ACP): Promise<string> => {
    const coder = hre.ethers.AbiCoder.defaultAbiCoder();
    return hre.ethers.keccak256(
      coder.encode(
        ['tuple(address,uint64,address,uint256,address,uint8,address[],bytes32[],bytes32,bytes,bytes)'],
        [
          [
            p.issuer,
            p.expiration,
            p.recipient,
            p.revokerData,
            p.revokerContract,
            p.scope,
            p.contracts,
            p.handles,
            p.sealingKey,
            p.issuerSignature,
            p.recipientSignature,
          ],
        ]
      )
    );
  };

  beforeEach(async () => {
    [bob, alice, carol] = await hre.ethers.getSigners();
    acl = await (await hre.ethers.getContractFactory('MockACL')).deploy();
    await acl.waitForDeployment();
    registry = await (await hre.ethers.getContractFactory('ACPShareRegistry')).deploy();
    await registry.waitForDeployment();
    revoker = await (await hre.ethers.getContractFactory('ACPTimestampRevoker')).deploy();
    await revoker.waitForDeployment();
  });

  // ------------------------------------------------------------------ share

  it('posts a share and lists it for the recipient', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await expect(registry.connect(bob).share(p)).to.emit(registry, 'Shared');

    const shares = await registry.sharesFor(alice.address);
    expect(shares.length).to.equal(1);
    expect(shares[0].issuer).to.equal(bob.address);
    expect(shares[0].recipient).to.equal(alice.address);
    expect(shares[0].issuerSignature).to.equal(p.issuerSignature);

    // and by id
    const id = await shareIdOf(p);
    expect((await registry.getShare(id)).issuer).to.equal(bob.address);
    expect(await registry.isShareValid(id)).to.equal(true);
  });

  it('lists shares from multiple issuers for one recipient', async () => {
    const p1 = await signedSharingPermission(acl, bob, alice.address);
    const p2 = await signedSharingPermission(acl, carol, alice.address);
    await registry.connect(bob).share(p1);
    await registry.connect(carol).share(p2);

    const shares = await registry.sharesFor(alice.address);
    expect(shares.length).to.equal(2);
  });

  it('rejects posting someone else’s share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await expect(registry.connect(carol).share(p)).to.be.revertedWithCustomError(registry, 'NotIssuer');
  });

  it('rejects a share without a recipient', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, { recipient: ZERO_ADDRESS });
    await expect(registry.connect(bob).share(p)).to.be.revertedWithCustomError(registry, 'RecipientMissing');
  });

  it('rejects a share carrying a sealing key', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, { sealingKey: DEFAULT_SEALING_KEY });
    await expect(registry.connect(bob).share(p)).to.be.revertedWithCustomError(registry, 'SealingKeyMustBeEmpty');
  });

  it('rejects an unsigned share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    p.issuerSignature = '0x';
    await expect(registry.connect(bob).share(p)).to.be.revertedWithCustomError(registry, 'IssuerSignatureMissing');
  });

  it('rejects an already-expired share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, {
      expiration: (await latestTimestamp()) - 1000n,
    });
    await expect(registry.connect(bob).share(p)).to.be.revertedWithCustomError(registry, 'ShareExpired');
  });

  it('rejects a duplicate share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p);
    await expect(registry.connect(bob).share(p)).to.be.revertedWithCustomError(registry, 'AlreadyShared');
  });

  // ----------------------------------------------------------------- remove

  it('issuer can retract a share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p);
    const id = await shareIdOf(p);

    await expect(registry.connect(bob).removeShare(id)).to.emit(registry, 'ShareRemoved');
    expect((await registry.sharesFor(alice.address)).length).to.equal(0);
    expect(await registry.isShareValid(id)).to.equal(false);
  });

  it('recipient can dismiss a share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p);
    await registry.connect(alice).removeShare(await shareIdOf(p));
    expect((await registry.sharesFor(alice.address)).length).to.equal(0);
  });

  it('a bystander cannot remove a share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p);
    await expect(registry.connect(carol).removeShare(await shareIdOf(p))).to.be.revertedWithCustomError(
      registry,
      'NotIssuerOrRecipient'
    );
  });

  it('removing an unknown share reverts', async () => {
    await expect(registry.connect(bob).removeShare(ZERO_BYTES32)).to.be.revertedWithCustomError(
      registry,
      'UnknownShare'
    );
  });

  it('removal keeps the remaining shares listed', async () => {
    const p1 = await signedSharingPermission(acl, bob, alice.address);
    const p2 = await signedSharingPermission(acl, bob, alice.address, { revokerData: 1n }); // distinct id
    const p3 = await signedSharingPermission(acl, bob, alice.address, { revokerData: 2n });
    await registry.connect(bob).share(p1);
    await registry.connect(bob).share(p2);
    await registry.connect(bob).share(p3);

    await registry.connect(bob).removeShare(await shareIdOf(p1));
    const shares = await registry.sharesFor(alice.address);
    expect(shares.length).to.equal(2);
    const sigs = shares.map((s: any) => s.issuerSignature);
    expect(sigs).to.include(p2.issuerSignature);
    expect(sigs).to.include(p3.issuerSignature);
  });

  // ----------------------------------------------------- validity filtering

  it('expired shares drop out of sharesFor and isShareValid', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, {
      expiration: (await latestTimestamp()) + 100n,
    });
    await registry.connect(bob).share(p);
    expect((await registry.sharesFor(alice.address)).length).to.equal(1);

    await advanceTime(200);
    expect((await registry.sharesFor(alice.address)).length).to.equal(0);
    expect(await registry.isShareValid(await shareIdOf(p))).to.equal(false);
  });

  it('revoking the underlying acp invalidates the share', async () => {
    const createdAt = await latestTimestamp();
    const p = await signedSharingPermission(acl, bob, alice.address, {
      revokerData: createdAt,
      revokerContract: await revoker.getAddress(),
    });
    await registry.connect(bob).share(p);
    const id = await shareIdOf(p);
    expect(await registry.isShareValid(id)).to.equal(true);

    await revoker.connect(bob).revokeSingle(createdAt);
    expect(await registry.isShareValid(id)).to.equal(false);
    expect((await registry.sharesFor(alice.address)).length).to.equal(0);
  });

  it('a reverting revoker fails closed (share invalid)', async () => {
    const broken = await (await hre.ethers.getContractFactory('RevertingValidator')).deploy();
    await broken.waitForDeployment();
    const p = await signedSharingPermission(acl, bob, alice.address, {
      revokerData: 1n,
      revokerContract: await broken.getAddress(),
    });
    await registry.connect(bob).share(p);
    expect(await registry.isShareValid(await shareIdOf(p))).to.equal(false);
  });
});
