import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

describe('CoFHE Plugin Config', async () => {
  // Config is accessible without a connection
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  it('createConfig returns a valid CofheConfig', async () => {
    const config = await cofhe.createConfig();
    assert.equal(typeof config, 'object');
    assert.equal(config.environment, 'hardhat');
  });

  it('createConfig propagates custom options', async () => {
    const config = await cofhe.createConfig({ mocks: { encryptDelay: 5 } });
    assert.equal(config.mocks?.encryptDelay, 5);
  });

  it('createClient returns an unconnected CofheClient', async () => {
    const config = await cofhe.createConfig();
    const client = cofhe.createClient(config);
    assert.equal(client.connected, false);
  });

  it('createClient can be connected with publicClient and walletClient', async () => {
    const config = await cofhe.createConfig();
    const client = cofhe.createClient(config);
    await client.connect(publicClient, walletClient);
    assert.equal(client.connected, true);
  });

  it('createClientWithBatteries uses the first wallet account when none provided', async () => {
    const [expectedAddress] = await walletClient.getAddresses();
    assert.ok(expectedAddress, 'expected at least one wallet address from viem walletClient');

    const client = await cofhe.createClientWithBatteries();
    assert.equal(client.connected, true);
    assert.equal(client.config.environment, 'hardhat');
    assert.equal(client.connection.account?.toLowerCase(), expectedAddress.toLowerCase());

    const activePermit = client.permits.getActivePermit();
    assert.ok(activePermit, 'expected createClientWithBatteries() to create and select an active permit');
    assert.equal(activePermit.issuer.toLowerCase(), expectedAddress.toLowerCase());
  });

  it('createClientWithBatteries accepts an explicit walletClient', async () => {
    const client = await cofhe.createClientWithBatteries(walletClient);
    assert.equal(client.connected, true);
  });
});
