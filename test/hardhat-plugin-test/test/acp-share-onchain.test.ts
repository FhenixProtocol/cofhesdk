import hre from 'hardhat';
import { FheTypes } from '@cofhe/sdk';
import { hardhat } from '@cofhe/sdk/chains';
import { expect } from 'chai';
import type { SharedSimpleTest } from '../typechain-types/contracts/SharedSimpleTest';

/**
 * On-chain sharing, end to end through the SDK client:
 *
 *   1. Bob stores an encrypted value and creates a signed sharing ACP for Alice
 *   2. Bob posts it to the ACPShareRegistry (shareOnChain)
 *   3. Alice discovers it (getIncomingShares), imports it (importFromChain),
 *      and decrypts Bob's value with the imported permit
 *   4. Alice dismisses the share — her incoming list is empty again
 */
describe('ACP on-chain sharing (SDK e2e)', () => {
  it('share → discover → import → decrypt → dismiss', async () => {
    const [bob, alice] = await hre.ethers.getSigners();

    // Registry deployed like any mock; its address flows in via config
    const registry = await (await hre.ethers.getContractFactory('ACPShareRegistry')).deploy();
    await registry.waitForDeployment();
    const registryAddress = (await registry.getAddress()) as `0x${string}`;

    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
      permit: { sharingRegistry: { 31337: registryAddress } },
    });

    // --- Bob: store a value and share access with Alice ---
    const bobClient = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(bobClient, bob);

    const simpleTest = (await (await hre.ethers.getContractFactory('SharedSimpleTest')).deploy()) as SharedSimpleTest;
    await simpleTest.waitForDeployment();
    await simpleTest.connect(bob).setValueTrivial(42);
    const ctHash = await simpleTest.getValueHash();

    const sharingPermit = await bobClient.acp.createSharing({
      issuer: bob.address,
      recipient: alice.address,
      name: 'Bob shares with Alice',
    });

    const { shareId } = await bobClient.acp.shareOnChain(sharingPermit);
    expect(shareId).to.match(/^0x[0-9a-f]{64}$/);

    // the client-side share id matches the registry's
    expect(await registry.isShareValid(shareId)).to.equal(true);

    // --- Alice: discover, import, decrypt ---
    const aliceClient = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(aliceClient, alice);

    const incoming = await aliceClient.acp.getIncomingShares();
    expect(incoming.length).to.equal(1);
    expect(incoming[0].issuer).to.equal(bob.address);
    expect(incoming[0].recipient).to.equal(alice.address);
    expect(incoming[0].shareId).to.equal(shareId);

    const imported = await aliceClient.acp.importFromChain(incoming[0]);
    expect(imported.type).to.equal('recipient');
    expect(imported.issuer).to.equal(bob.address);

    // Alice decrypts Bob's value using the imported permit (active after import)
    const unsealed = await aliceClient.decryptForView(ctHash, FheTypes.Uint32).execute();
    expect(unsealed).to.equal(42n);

    // --- Alice dismisses the share ---
    await aliceClient.acp.dismissShare(shareId);
    expect((await aliceClient.acp.getIncomingShares()).length).to.equal(0);
    expect(await registry.isShareValid(shareId)).to.equal(false);
  });

  it('issuer can cancel a pending share before import', async () => {
    const [bob, alice] = await hre.ethers.getSigners();

    const registry = await (await hre.ethers.getContractFactory('ACPShareRegistry')).deploy();
    await registry.waitForDeployment();

    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
      permit: { sharingRegistry: { 31337: (await registry.getAddress()) as `0x${string}` } },
    });

    const bobClient = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(bobClient, bob);

    const sharingPermit = await bobClient.acp.createSharing({
      issuer: bob.address,
      recipient: alice.address,
    });
    const { shareId } = await bobClient.acp.shareOnChain(sharingPermit);

    await bobClient.acp.cancelShare(shareId);

    const aliceClient = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(aliceClient, alice);
    expect((await aliceClient.acp.getIncomingShares()).length).to.equal(0);
  });

  it('resolves the share registry from the ACL when config names none', async () => {
    const [bob, alice] = await hre.ethers.getSigners();

    // No `permit.sharingRegistry` — the client must discover the plugin-deployed
    // registry via TaskManager -> acl() -> shareRegistry()
    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
    });

    const bobClient = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(bobClient, bob);

    const sharingPermit = await bobClient.acp.createSharing({
      issuer: bob.address,
      recipient: alice.address,
    });
    const { shareId } = await bobClient.acp.shareOnChain(sharingPermit);

    const aclRegistry = await (await hre.cofhe.mocks.getMockACL()).shareRegistry();
    const registry = await hre.ethers.getContractAt('ACPShareRegistry', aclRegistry);
    expect(await registry.isShareValid(shareId)).to.equal(true);

    const aliceClient = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(aliceClient, alice);
    const incoming = await aliceClient.acp.getIncomingShares();
    expect(incoming.length).to.equal(1);
    expect(incoming[0].shareId).to.equal(shareId);

    // The ACL-served default revoker was applied at creation
    const aclRevoker = await (await hre.cofhe.mocks.getMockACL()).defaultRevokerContract();
    expect(sharingPermit.revokerContract.toLowerCase()).to.equal(aclRevoker.toLowerCase());

    await aliceClient.acp.dismissShare(shareId);
  });

  it('shareOnChain rejects a self permit', async () => {
    const [bob] = await hre.ethers.getSigners();

    const registry = await (await hre.ethers.getContractFactory('ACPShareRegistry')).deploy();
    await registry.waitForDeployment();

    const config = await hre.cofhe.createConfig({
      environment: 'hardhat',
      supportedChains: [hardhat],
      permit: { sharingRegistry: { 31337: (await registry.getAddress()) as `0x${string}` } },
    });

    const client = hre.cofhe.createClient(config);
    await hre.cofhe.connectWithHardhatSigner(client, bob);

    const selfPermit = await client.acp.createSelf({ issuer: bob.address });

    try {
      await client.acp.shareOnChain(selfPermit);
      expect.fail('expected shareOnChain to throw');
    } catch (e: any) {
      expect(e.message).to.match(/only 'sharing' ACPs are shareable/);
    }
  });
});
