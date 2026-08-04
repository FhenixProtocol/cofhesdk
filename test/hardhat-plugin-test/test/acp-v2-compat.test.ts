import hre from 'hardhat';
import { expect } from 'chai';
// NOTE: from the node entry — each SDK bundle entry carries its own probe
// caches, and hre.cofhe's client lives in the node entry.
import { clearAclCaches } from '@cofhe/sdk/node';
import { hardhat } from '@cofhe/sdk/chains';
import { ACPUtils } from '@cofhe/sdk/permits';

/**
 * Backward compat, end to end against a real V2 ACL:
 *
 * The LegacyMockACLV2 fixture is the released (pre-ACP) permit verification
 * verbatim — EIP712("ACL","1") domain, Permission struct, PermissionedV2*
 * typehashes, ECDSA checks. The TaskManager's ACL pointer is swapped to it, so
 * the SDK's probe discovers a V2 chain and everything downstream must follow:
 * the legacy engine signs, the permit is v2-tagged, and — the money assertion —
 * the V2 ACL accepts the signature via checkPermitValidity.
 */
describe('ACP backward compat (V2 chain e2e)', () => {
  let prevAcl: string;
  let taskManager: any;

  before(async () => {
    taskManager = await hre.cofhe.mocks.getMockTaskManager();
    prevAcl = await taskManager.acl();

    const fixture = await (await hre.ethers.getContractFactory('LegacyMockACLV2')).deploy();
    await fixture.waitForDeployment();
    await (await taskManager.setACLContract(await fixture.getAddress())).wait();

    // Forget prior probes for this chainId — the ACL just "downgraded"
    clearAclCaches();
  });

  after(async () => {
    await (await taskManager.setACLContract(prevAcl)).wait();
    clearAclCaches();
  });

  it('creates, signs, and on-chain-validates a permit against the V2 ACL', async () => {
    const [bob] = await hre.ethers.getSigners();
    const { publicClient, walletClient } = await hre.cofhe.hardhatSignerAdapter(bob);

    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
    });
    const client = hre.cofhe.createClient(config);
    await client.connect(publicClient, walletClient);

    // Sanity: the swapped-in fixture serves the V2 domain
    const domain = await ACPUtils.fetchEIP712Domain(publicClient);
    expect(domain.name).to.equal('ACL');
    expect(domain.version).to.equal('1');

    const permit = await client.acp.createSelf({ issuer: bob.address, name: 'v2 compat self' });

    // The probe steered creation through the legacy engine
    expect(permit.format).to.equal('v2');
    expect(permit._signedDomain?.name).to.equal('ACL');
    expect(permit._signedDomain?.version).to.equal('1');
    // Normalized shape is global — V2 has no scope
    expect(permit.scope).to.equal(0);
    expect(permit.contracts).to.deep.equal([]);

    // The V2 ACL accepts the PermissionedV2 signature (ECDSA verified on-chain)
    expect(await ACPUtils.checkValidityOnChain(permit, publicClient)).to.equal(true);
  });

  it('the V2 ACL rejects a tampered signature', async () => {
    const [bob] = await hre.ethers.getSigners();
    const { publicClient, walletClient } = await hre.cofhe.hardhatSignerAdapter(bob);

    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
    });
    const client = hre.cofhe.createClient(config);
    await client.connect(publicClient, walletClient);

    const permit = await client.acp.createSelf({ issuer: bob.address });
    const tampered = {
      ...permit,
      // flip the last nibble of the issuer signature
      issuerSignature: (permit.issuerSignature.slice(0, -1) +
        (permit.issuerSignature.endsWith('0') ? '1' : '0')) as `0x${string}`,
    };

    try {
      await ACPUtils.checkValidityOnChain(tampered, publicClient);
      expect.fail('expected the V2 ACL to reject the tampered signature');
    } catch (e: any) {
      expect(e.message).to.match(/PermissionInvalid_IssuerSignature/);
    }
  });

  it('scoped options are rejected on a V2 chain', async () => {
    const [bob, alice] = await hre.ethers.getSigners();
    const { publicClient, walletClient } = await hre.cofhe.hardhatSignerAdapter(bob);

    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
    });
    const client = hre.cofhe.createClient(config);
    await client.connect(publicClient, walletClient);

    try {
      await client.acp.createSelf({ issuer: bob.address, contracts: [alice.address] });
      expect.fail('expected scoped creation to throw on a V2 chain');
    } catch (e: any) {
      expect(e.message).to.match(/upgraded/);
    }
  });
});
