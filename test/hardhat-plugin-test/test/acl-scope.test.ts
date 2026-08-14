import hre from 'hardhat';
import { expect } from 'chai';
import type { Contract } from 'ethers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * ACP (ACP V3) — the ACL scope check table.
 *
 * One test per row:
 *
 *   | condition                                            | result |
 *   |------------------------------------------------------|--------|
 *   | permission structure invalid (expired/sig/revoked)   | REVERT |
 *   | issuer does NOT have access to handle                | false  |
 *   | scope == GLOBAL                                    | true   |
 *   | any permission.contracts allowed for handle          | true   |
 *   | permission.handles contains handle                   | true   |
 *   | otherwise                                            | false  |
 *
 * Contract scope = intersection over the ACL's EXISTING persistedAllowedPairs
 * (populated via FHE.allow/allowThis) — no new data structures.
 */

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const TYPES_ISSUER_SELF = {
  ACPIssuerSelf: [
    { name: 'issuer', type: 'address' },
    { name: 'expiration', type: 'uint64' },
    { name: 'recipient', type: 'address' },
    { name: 'revokerData', type: 'uint256' },
    { name: 'revokerContract', type: 'address' },
    { name: 'scope', type: 'uint8' },
    { name: 'contracts', type: 'address[]' },
    { name: 'handles', type: 'bytes32[]' },
    { name: 'sealingKey', type: 'bytes32' },
  ],
};

// arbitrary "contract" addresses — persistedAllowedPairs keys need no code behind them
const CONTRACT_A = '0x' + 'aaaa'.padStart(40, '0');
const CONTRACT_B = '0x' + 'bbbb'.padStart(40, '0');

const b32 = (v: bigint) => ('0x' + v.toString(16).padStart(64, '0')) as `0x${string}`;

const H1 = 101n;
const H2 = 202n;
const H_UNSEEDED = 999n;

describe('ACP scope table (MockACL.isAllowedWithPermission)', () => {
  let acl: Contract;
  let issuer: HardhatEthersSigner;
  let tm: HardhatEthersSigner;
  let now: bigint;

  before(async () => {
    [issuer] = await hre.ethers.getSigners();

    acl = await (await hre.ethers.getContractFactory('MockACL')).deploy();
    await acl.waitForDeployment();

    // impersonate the TaskManager — the only address allowed to write the ACL
    const tmAddress = await acl.TASK_MANAGER_ADDRESS_();
    await hre.network.provider.send('hardhat_impersonateAccount', [tmAddress]);
    await hre.network.provider.send('hardhat_setBalance', [tmAddress, '0x' + (10n ** 20n).toString(16)]);
    tm = await hre.ethers.getSigner(tmAddress);

    // Seed persisted allowances the way the real TM bootstraps them:
    // transient grant to the TM itself, then persisted grants in the SAME block
    // (the mock's transient approximation is block-scoped).
    //   H1 -> issuer, CONTRACT_A
    //   H2 -> issuer, CONTRACT_B   (A deliberately NOT allowed for H2)
    await hre.network.provider.send('evm_setAutomine', [false]);
    const aclTm = acl.connect(tm) as Contract;
    const txs = [
      await aclTm.allowTransient(H1, tmAddress, tmAddress, { gasLimit: 500_000 }),
      await aclTm.allow(H1, issuer.address, tmAddress, { gasLimit: 500_000 }),
      await aclTm.allow(H1, CONTRACT_A, tmAddress, { gasLimit: 500_000 }),
      await aclTm.allowTransient(H2, tmAddress, tmAddress, { gasLimit: 500_000 }),
      await aclTm.allow(H2, issuer.address, tmAddress, { gasLimit: 500_000 }),
      await aclTm.allow(H2, CONTRACT_B, tmAddress, { gasLimit: 500_000 }),
    ];
    await hre.network.provider.send('evm_mine');
    await hre.network.provider.send('evm_setAutomine', [true]);
    for (const tx of txs) await tx.wait();

    now = BigInt((await hre.ethers.provider.getBlock('latest'))!.timestamp);
  });

  after(async () => {
    await hre.network.provider.send('evm_setAutomine', [true]);
  });

  /** Signed self permission with the given scope. */
  const permission = async (scope: { scope?: number; contracts?: string[]; handles?: string[] }) => {
    const p = {
      issuer: issuer.address,
      expiration: now + 7n * 24n * 3600n,
      recipient: ZERO_ADDRESS,
      revokerData: 0n,
      revokerContract: ZERO_ADDRESS,
      scope: scope.scope ?? (scope.contracts?.length ? 1 : scope.handles?.length ? 2 : 0),
      contracts: scope.contracts ?? [],
      handles: scope.handles ?? [],
      sealingKey: '0x' + '5ea1'.padStart(64, '0'),
      issuerSignature: '0x',
      recipientSignature: '0x',
    };
    const domain = {
      name: 'ACL',
      version: '2',
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: await acl.getAddress(),
    };
    p.issuerSignature = await issuer.signTypedData(domain, TYPES_ISSUER_SELF, p);
    return p;
  };

  // ------------------------------------------------------------- table rows

  it('row: invalid structure (expired) — REVERT', async () => {
    const p = await permission({});
    p.expiration = now - 1000n;
    p.issuerSignature = '0x'; // (re-signing an expired acp would also revert — keep it simple)
    await expect(acl.isAllowedWithPermission(p, H1)).to.be.reverted;
  });

  it('row: issuer has no access to handle — false (even with global scope)', async () => {
    const p = await permission({});
    expect(await acl.isAllowedWithPermission(p, H_UNSEEDED)).to.equal(false);
  });

  it('row: global scope — true', async () => {
    const p = await permission({});
    expect(await acl.isAllowedWithPermission(p, H1)).to.equal(true);
  });

  it('row: contract scope, contract allowed for handle — true', async () => {
    const p = await permission({ contracts: [CONTRACT_A] });
    expect(await acl.isAllowedWithPermission(p, H1)).to.equal(true);
  });

  it('row: contract scope, later array element matches — true (loop coverage)', async () => {
    const p = await permission({ contracts: [CONTRACT_B, CONTRACT_A] });
    expect(await acl.isAllowedWithPermission(p, H1)).to.equal(true);
  });

  it('row: contract scope, contract not allowed for this handle — false', async () => {
    // CONTRACT_A is seeded for H1, not H2 — an ACP scoped to A must not read H2
    const p = await permission({ contracts: [CONTRACT_A] });
    expect(await acl.isAllowedWithPermission(p, H2)).to.equal(false);
  });

  it('row: handle scope, handle in list — true', async () => {
    const p = await permission({ handles: [b32(H2), b32(H1)] });
    expect(await acl.isAllowedWithPermission(p, H1)).to.equal(true);
  });

  it('row: handle scope, handle not in list — false', async () => {
    const p = await permission({ handles: [b32(H2)] });
    expect(await acl.isAllowedWithPermission(p, H1)).to.equal(false);
  });

  it('row: scoped but empty list — false, despite issuer access', async () => {
    // scope CONTRACT with no contracts (and scope HANDLES with no handles) can't
    // match anything; the client-side refinement rejects these, the ACL just says no
    const pContract = await permission({ scope: 1 });
    expect(await acl.isAllowedWithPermission(pContract, H1)).to.equal(false);
    const pHandles = await permission({ scope: 2 });
    expect(await acl.isAllowedWithPermission(pHandles, H1)).to.equal(false);
  });

  // --------------------------------------------------- narrowing invariants

  it('scopes never widen: contract allowed for handle, but issuer lacks access — false', async () => {
    // CONTRACT_B is allowed for H2, but this acp's issuer is a fresh account
    // with no access — the contract scope must not grant anything
    const [, freshIssuer] = await hre.ethers.getSigners();
    const p = {
      issuer: freshIssuer.address,
      expiration: now + 7n * 24n * 3600n,
      recipient: ZERO_ADDRESS,
      revokerData: 0n,
      revokerContract: ZERO_ADDRESS,
      scope: 1,
      contracts: [CONTRACT_B],
      handles: [] as string[],
      sealingKey: '0x' + '5ea1'.padStart(64, '0'),
      issuerSignature: '0x',
      recipientSignature: '0x',
    };
    const domain = {
      name: 'ACL',
      version: '2',
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      verifyingContract: await acl.getAddress(),
    };
    p.issuerSignature = await freshIssuer.signTypedData(domain, TYPES_ISSUER_SELF, p);
    expect(await acl.isAllowedWithPermission(p, H2)).to.equal(false);
  });

  it('ciphertext scope narrows too: handle in list but issuer lacks access — false', async () => {
    const p = await permission({ handles: [b32(H_UNSEEDED)] });
    expect(await acl.isAllowedWithPermission(p, H_UNSEEDED)).to.equal(false);
  });

  // ------------------------------------------------ V3 replaced V2 in place

  it('V2 entry points are replaced in place on the ACL itself', async () => {
    expect(acl.interface.getFunction('checkACPValidity')).to.equal(null);
    expect(acl.interface.getFunction('acpVerifier')).to.equal(null);
    // isAllowedWithPermission keeps its V2 name but now takes the ACP struct
    const fn = acl.interface.getFunction('isAllowedWithPermission');
    expect(fn!.inputs[0].components!.length).to.equal(11);
    expect(typeof acl.checkPermissionValidity).to.equal('function');
    expect(typeof acl.eip712Domain).to.equal('function');
  });
});
