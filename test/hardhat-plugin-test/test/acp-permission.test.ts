import hre from 'hardhat';
import { expect } from 'chai';
import { keccak256, toUtf8Bytes, type Contract } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * ACP (Permit V3) Permission struct — sign & verify round-trip.
 *
 * Signs with ethers `signTypedData` (the real JS wallet path) against the
 * deployed MockACP verifier, proving JS <> Solidity EIP-712 parity for the new
 * struct — including the dynamic-array fields (contracts[], handles[]).
 *
 * Scope semantics (global/contracts/handles vs a handle) are the ACL's job and
 * are exercised against MockACL in a separate increment; this suite covers
 * structure only: expiration, signatures, validator hook.
 */

const ACP_DOMAIN_NAME = 'ACL';
const ACP_DOMAIN_VERSION = '2';

const TYPES_ISSUER_SELF = {
  ACPIssuerSelf: [
    { name: 'issuer', type: 'address' },
    { name: 'expiration', type: 'uint64' },
    { name: 'recipient', type: 'address' },
    { name: 'validatorId', type: 'uint256' },
    { name: 'validatorContract', type: 'address' },
    { name: 'global', type: 'bool' },
    { name: 'contracts', type: 'address[]' },
    { name: 'handles', type: 'uint256[]' },
    { name: 'sealingKey', type: 'bytes32' },
  ],
};

const TYPES_ISSUER_SHARED = {
  ACPIssuerShared: [
    { name: 'issuer', type: 'address' },
    { name: 'expiration', type: 'uint64' },
    { name: 'recipient', type: 'address' },
    { name: 'validatorId', type: 'uint256' },
    { name: 'validatorContract', type: 'address' },
    { name: 'global', type: 'bool' },
    { name: 'contracts', type: 'address[]' },
    { name: 'handles', type: 'uint256[]' },
  ],
};

const TYPES_RECIPIENT = {
  ACPRecipient: [
    { name: 'sealingKey', type: 'bytes32' },
    { name: 'issuerSignature', type: 'bytes' },
  ],
};

const SEALING_KEY_ISSUER = '0x' + '5ea1'.padStart(64, '0');
const SEALING_KEY_RECIPIENT = '0x' + '5ea2'.padStart(64, '0');
const SEALING_KEY_EVIL = '0x' + 'e011'.padStart(64, '0');
const ZERO_BYTES32 = '0x' + '0'.repeat(64);
const ZERO_ADDRESS = '0x' + '0'.repeat(40);

type Permission = {
  issuer: string;
  expiration: bigint;
  recipient: string;
  validatorId: bigint;
  validatorContract: string;
  global: boolean;
  contracts: string[];
  handles: bigint[];
  sealingKey: string;
  issuerSignature: string;
  recipientSignature: string;
};

describe('ACP Permission (V3 struct)', () => {
  let acp: Contract;
  let validator: Contract;
  let issuer: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let now: bigint;

  const domain = async () => ({
    name: ACP_DOMAIN_NAME,
    version: ACP_DOMAIN_VERSION,
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
    verifyingContract: await acp.getAddress(),
  });

  before(async () => {
    [issuer, recipient, stranger] = await hre.ethers.getSigners();
    acp = await (await hre.ethers.getContractFactory('MockACP')).deploy();
    await acp.waitForDeployment();
    validator = await (await hre.ethers.getContractFactory('StubValidator')).deploy();
    await validator.waitForDeployment();
    const block = await hre.ethers.provider.getBlock('latest');
    now = BigInt(block!.timestamp);
  });

  /** A self permission with global scope and no validator (minimal V3 permit). */
  const basePermission = (): Permission => ({
    issuer: issuer.address,
    expiration: now + 7n * 24n * 3600n,
    recipient: ZERO_ADDRESS,
    validatorId: 0n,
    validatorContract: ZERO_ADDRESS,
    global: true,
    contracts: [],
    handles: [],
    sealingKey: SEALING_KEY_ISSUER,
    issuerSignature: '0x',
    recipientSignature: '0x',
  });

  const signIssuer = async (p: Permission, signer: HardhatEthersSigner = issuer): Promise<Permission> => {
    const isSelf = p.recipient === ZERO_ADDRESS;
    const types = isSelf ? TYPES_ISSUER_SELF : TYPES_ISSUER_SHARED;
    const signature = await signer.signTypedData(await domain(), types, p);
    return { ...p, issuerSignature: signature };
  };

  const signRecipient = async (p: Permission, signer: HardhatEthersSigner = recipient): Promise<Permission> => {
    const signature = await signer.signTypedData(await domain(), TYPES_RECIPIENT, {
      sealingKey: p.sealingKey,
      issuerSignature: p.issuerSignature,
    });
    return { ...p, recipientSignature: signature };
  };

  /**
   * Step 1 (issuer): recipient set, NO sealingKey in the signed payload.
   * Step 2 (recipient): fills own sealingKey, signs < sealingKey, issuerSignature >.
   */
  const sharedPermission = async (): Promise<Permission> => {
    let p = basePermission();
    p.recipient = recipient.address;
    p.sealingKey = ZERO_BYTES32; // issuer leaves it empty
    p = await signIssuer(p);
    p.sealingKey = SEALING_KEY_RECIPIENT; // recipient's own key
    p = await signRecipient(p);
    return p;
  };

  // ------------------------------------------------------------- self permit

  describe('self permit', () => {
    it('valid permit passes', async () => {
      const p = await signIssuer(basePermission());
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('valid permit with populated scope arrays passes', async () => {
      let p = basePermission();
      p.global = false;
      p.contracts = ['0x' + 'c0ffee'.padStart(40, '0'), '0x' + 'decaf'.padStart(40, '0')];
      p.handles = [42n, 1337n];
      p = await signIssuer(p);
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('expired permit reverts', async () => {
      let p = basePermission();
      p.expiration = now - 1000n;
      p = await signIssuer(p);
      await expect(acp.checkPermissionValidity(p)).to.be.revertedWithCustomError(acp, 'PermissionInvalid_Expired');
    });

    it('permit signed by a stranger reverts', async () => {
      const p = await signIssuer(basePermission(), stranger);
      await expect(acp.checkPermissionValidity(p)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_IssuerSignature'
      );
    });
  });

  // ------------------------------------------- tampering (issuer signature)

  describe('tampering after signing invalidates the issuer signature', () => {
    const expectIssuerSigRevert = async (p: Permission) => {
      await expect(acp.checkPermissionValidity(p)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_IssuerSignature'
      );
    };

    it('tampered expiration', async () => {
      const p = await signIssuer(basePermission());
      await expectIssuerSigRevert({ ...p, expiration: p.expiration + 24n * 3600n });
    });

    it('tampered global flag (scope widening)', async () => {
      let p = basePermission();
      p.global = false;
      p = await signIssuer(p);
      await expectIssuerSigRevert({ ...p, global: true });
    });

    it('tampered contracts array', async () => {
      const p = await signIssuer(basePermission());
      await expectIssuerSigRevert({ ...p, contracts: ['0x' + 'e011'.padStart(40, '0')] });
    });

    it('tampered handles array', async () => {
      const p = await signIssuer(basePermission());
      await expectIssuerSigRevert({ ...p, handles: [1337n] });
    });

    it('tampered validator fields (stripping revocability)', async () => {
      let p = basePermission();
      p.validatorId = now;
      p.validatorContract = await validator.getAddress();
      p = await signIssuer(p);
      await expectIssuerSigRevert({ ...p, validatorId: 0n });
    });

    it('tampered sealingKey (prevents redirecting decryption output)', async () => {
      const p = await signIssuer(basePermission());
      await expectIssuerSigRevert({ ...p, sealingKey: SEALING_KEY_EVIL });
    });
  });

  // ------------------------------------------------------------ sharing flow

  describe('sharing flow (two-step, two signatures)', () => {
    it('issuer shares without sealingKey, recipient completes — passes', async () => {
      const p = await sharedPermission();
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('recipient may pick any sealingKey (issuer signature does not cover it)', async () => {
      let p = basePermission();
      p.recipient = recipient.address;
      p = await signIssuer(p);
      p.sealingKey = '0x' + 'feed'.padStart(64, '0');
      p = await signRecipient(p);
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('third party swapping sealingKey after recipient signed reverts', async () => {
      const p = await sharedPermission();
      await expect(acp.checkPermissionValidity({ ...p, sealingKey: SEALING_KEY_EVIL })).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_RecipientSignature'
      );
    });

    it('missing recipient signature reverts', async () => {
      let p = basePermission();
      p.recipient = recipient.address;
      p = await signIssuer(p);
      await expect(acp.checkPermissionValidity(p)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_RecipientSignature'
      );
    });

    it('recipient signature by a stranger reverts', async () => {
      let p = basePermission();
      p.recipient = recipient.address;
      p = await signIssuer(p);
      p.sealingKey = SEALING_KEY_RECIPIENT;
      p = await signRecipient(p, stranger);
      await expect(acp.checkPermissionValidity(p)).to.be.revertedWithCustomError(
        acp,
        'PermissionInvalid_RecipientSignature'
      );
    });
  });

  // -------------------------------------------------------------- validator

  describe('validator hook (interface unchanged from V2)', () => {
    it('validatorId = 0 skips the check even if the validator reports disabled', async () => {
      await validator.set(true);
      let p = basePermission();
      p.validatorId = 0n;
      p.validatorContract = await validator.getAddress();
      p = await signIssuer(p);
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('validatorContract = address(0) skips the check', async () => {
      let p = basePermission();
      p.validatorId = now; // default-validator convention: creation timestamp
      p.validatorContract = ZERO_ADDRESS;
      p = await signIssuer(p);
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('validator not disabled — permit valid', async () => {
      await validator.set(false);
      let p = basePermission();
      p.validatorId = now;
      p.validatorContract = await validator.getAddress();
      p = await signIssuer(p);
      expect(await acp.checkPermissionValidity(p)).to.equal(true);
    });

    it('validator disabled — permit reverts', async () => {
      await validator.set(true);
      let p = basePermission();
      p.validatorId = now;
      p.validatorContract = await validator.getAddress();
      p = await signIssuer(p);
      await expect(acp.checkPermissionValidity(p)).to.be.revertedWithCustomError(acp, 'PermissionInvalid_Disabled');
    });

    it('reverting validator fails closed (never validates)', async () => {
      const broken = await (await hre.ethers.getContractFactory('RevertingValidator')).deploy();
      await broken.waitForDeployment();
      let p = basePermission();
      p.validatorId = now;
      p.validatorContract = await broken.getAddress();
      p = await signIssuer(p);
      await expect(acp.checkPermissionValidity(p)).to.be.reverted;
    });
  });

  // ------------------------------------------------------- V3 typehash pin

  describe('typehash freeze', () => {
    // Pins the exact V3 typehash strings. If this test breaks, the cross-repo
    // wire format (sdk <> contracts <> CoFHE) changed — bump the domain version
    // and coordinate, don't just fix the test.
    it('ACPIssuerSelf / ACPIssuerShared / ACPRecipient typehashes are pinned', () => {
      expect(
        keccak256(
          toUtf8Bytes(
            'ACPIssuerSelf(address issuer,uint64 expiration,address recipient,uint256 validatorId,address validatorContract,bool global,address[] contracts,uint256[] handles,bytes32 sealingKey)'
          )
        )
      ).to.equal('0xcb570a16e5462f1eb5a5e297381312ac733c363ae7383f530a78e011b922663b');
      expect(
        keccak256(
          toUtf8Bytes(
            'ACPIssuerShared(address issuer,uint64 expiration,address recipient,uint256 validatorId,address validatorContract,bool global,address[] contracts,uint256[] handles)'
          )
        )
      ).to.equal('0x78d4dc89504fadebf121225e739c38cc5e5ad8a2a53a3892795e02798fb459c0');
      expect(keccak256(toUtf8Bytes('ACPRecipient(bytes32 sealingKey,bytes issuerSignature)'))).to.equal(
        '0xa61bec9390ffc1eea10897f1dc01a2abf1b8210f228d8235fb672f8754f639d6'
      );
    });
  });
});
