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
 * The registry is a dumb, pointer-based store — the payload and its metadata travel in the
 * `Shared` event; storage keeps the head — with three guarantees:
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
    const id = await shareIdOf(p);
    await expect(registry.connect(bob).share(p, '0x')).to.emit(registry, 'Shared');

    // storage lists the head; the payload is in the event
    const { shareIds, heads } = await registry.sharesFor(alice.address);
    expect(shareIds).to.deep.equal([id]);
    expect(heads[0].issuer).to.equal(bob.address);
    expect(heads[0].recipient).to.equal(alice.address);
    expect(heads[0].blockNumber).to.equal(BigInt(await hre.ethers.provider.getBlockNumber()));

    // and by id
    expect((await registry.getShare(id)).issuer).to.equal(bob.address);
    expect(await registry.isShareValid(id)).to.equal(true);
  });

  it('carries the full payload and the metadata in the Shared event of the block the head names', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    const id = await shareIdOf(p);
    const metadata = '0x03' + 'ab'.repeat(40);
    await registry.connect(bob).share(p, metadata);

    const { blockNumber } = await registry.getShare(id);
    const logs = await registry.queryFilter(
      registry.filters.Shared(undefined, undefined, id),
      blockNumber,
      blockNumber
    );
    expect(logs).to.have.length(1);
    const { args } = logs[0] as any;
    expect(args.recipient).to.equal(alice.address);
    expect(args.issuer).to.equal(bob.address);
    expect(args.acp.issuerSignature).to.equal(p.issuerSignature);
    expect([...args.acp.handles]).to.deep.equal([...p.handles]);
    expect(args.metadata).to.equal(metadata);
  });

  it('rejects the same share again even with other metadata (labels are written once)', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p, '0x0301');
    await expect(registry.connect(bob).share(p, '0x0302')).to.be.revertedWithCustomError(registry, 'AlreadyShared');
  });

  it('lists shares from multiple issuers for one recipient', async () => {
    const p1 = await signedSharingPermission(acl, bob, alice.address);
    const p2 = await signedSharingPermission(acl, carol, alice.address);
    await registry.connect(bob).share(p1, '0x');
    await registry.connect(carol).share(p2, '0x');

    const { heads } = await registry.sharesFor(alice.address);
    expect([...heads].map((h: any) => h.issuer)).to.have.members([bob.address, carol.address]);
  });

  it('rejects posting someone else’s share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await expect(registry.connect(carol).share(p, '0x')).to.be.revertedWithCustomError(registry, 'NotIssuer');
  });

  it('rejects a share without a recipient', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, { recipient: ZERO_ADDRESS });
    await expect(registry.connect(bob).share(p, '0x')).to.be.revertedWithCustomError(registry, 'RecipientMissing');
  });

  it('rejects a share carrying a sealing key', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, { sealingKey: DEFAULT_SEALING_KEY });
    await expect(registry.connect(bob).share(p, '0x')).to.be.revertedWithCustomError(registry, 'SealingKeyMustBeEmpty');
  });

  it('rejects an unsigned share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    p.issuerSignature = '0x';
    await expect(registry.connect(bob).share(p, '0x')).to.be.revertedWithCustomError(
      registry,
      'IssuerSignatureMissing'
    );
  });

  it('rejects an already-expired share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, {
      expiration: (await latestTimestamp()) - 1000n,
    });
    await expect(registry.connect(bob).share(p, '0x')).to.be.revertedWithCustomError(registry, 'ShareExpired');
  });

  it('rejects a duplicate share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p, '0x');
    await expect(registry.connect(bob).share(p, '0x')).to.be.revertedWithCustomError(registry, 'AlreadyShared');
  });

  // ----------------------------------------------------------------- remove

  it('issuer can retract a share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p, '0x');
    const id = await shareIdOf(p);

    await expect(registry.connect(bob).removeShare(id)).to.emit(registry, 'ShareRemoved');
    expect((await registry.sharesFor(alice.address)).shareIds.length).to.equal(0);
    expect(await registry.isShareValid(id)).to.equal(false);
  });

  it('recipient can dismiss a share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p, '0x');
    await registry.connect(alice).removeShare(await shareIdOf(p));
    expect((await registry.sharesFor(alice.address)).shareIds.length).to.equal(0);
  });

  it('a bystander cannot remove a share', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address);
    await registry.connect(bob).share(p, '0x');
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
    await registry.connect(bob).share(p1, '0x');
    await registry.connect(bob).share(p2, '0x');
    await registry.connect(bob).share(p3, '0x');

    await registry.connect(bob).removeShare(await shareIdOf(p1));
    const { shareIds } = await registry.sharesFor(alice.address);
    expect([...shareIds]).to.have.members([await shareIdOf(p2), await shareIdOf(p3)]);
  });

  // ----------------------------------------------------- validity filtering

  it('expired shares drop out of sharesFor and isShareValid', async () => {
    const p = await signedSharingPermission(acl, bob, alice.address, {
      expiration: (await latestTimestamp()) + 100n,
    });
    await registry.connect(bob).share(p, '0x');
    expect((await registry.sharesFor(alice.address)).shareIds.length).to.equal(1);

    await advanceTime(200);
    expect((await registry.sharesFor(alice.address)).shareIds.length).to.equal(0);
    expect(await registry.isShareValid(await shareIdOf(p))).to.equal(false);
  });

  it('revoking the underlying acp invalidates the share', async () => {
    const createdAt = await latestTimestamp();
    const p = await signedSharingPermission(acl, bob, alice.address, {
      revokerData: createdAt,
      revokerContract: await revoker.getAddress(),
    });
    await registry.connect(bob).share(p, '0x');
    const id = await shareIdOf(p);
    expect(await registry.isShareValid(id)).to.equal(true);

    await revoker.connect(bob).revokeSingle(createdAt);
    expect(await registry.isShareValid(id)).to.equal(false);
    expect((await registry.sharesFor(alice.address)).shareIds.length).to.equal(0);
  });

  it('a reverting revoker fails closed (share invalid)', async () => {
    const broken = await (await hre.ethers.getContractFactory('RevertingValidator')).deploy();
    await broken.waitForDeployment();
    const p = await signedSharingPermission(acl, bob, alice.address, {
      revokerData: 1n,
      revokerContract: await broken.getAddress(),
    });
    await registry.connect(bob).share(p, '0x');
    expect(await registry.isShareValid(await shareIdOf(p))).to.equal(false);
  });
});
