import hre from 'hardhat';
import { expect } from 'chai';
import { hardhat as hardhatChain } from '@cofhe/sdk/chains';

describe('CoFHE Plugin Config', () => {
  it('injects cofhe config defaults into hre.config', () => {
    expect(hre.config.cofhe).to.be.an('object');
    expect(hre.config.cofhe.logMocks).to.be.a('boolean');
    expect(hre.config.cofhe.gasWarning).to.be.a('boolean');
  });

  it('exposes publicClient and walletClient on hre.cofhe', async () => {
    const chainId = await hre.cofhe.publicClient.getChainId();
    expect(chainId).to.be.a('number');

    const addresses = await hre.cofhe.walletClient.getAddresses();
    expect(addresses).to.have.length.greaterThan(0);
  });
});

describe('CoFHE SDK Client', () => {
  it('createConfig returns a valid CofheConfig', async () => {
    const config = await hre.cofhe.createConfig({ supportedChains: [hardhatChain] });

    expect(config.environment).to.equal('hardhat');
    expect(config.supportedChains).to.deep.equal([hardhatChain]);
    expect(config._internal?.zkvWalletClient).to.not.be.undefined;
  });

  it('createConfig propagates custom options', async () => {
    const config = await hre.cofhe.createConfig({
      supportedChains: [hardhatChain],
      defaultPermitExpiration: 3600,
      mocks: { decryptDelay: 200 },
    });

    expect(config.defaultPermitExpiration).to.equal(3600);
    expect(config.mocks.decryptDelay).to.equal(200);
  });

  it('createClient returns an unconnected CofheClient', async () => {
    const config = await hre.cofhe.createConfig({ supportedChains: [hardhatChain] });
    const client = hre.cofhe.createClient(config);

    expect(client).to.not.be.undefined;
    expect(client.config).to.equal(config);
    expect(client.connected).to.be.false;
  });

  it('createClient can be connected with publicClient and walletClient', async () => {
    const config = await hre.cofhe.createConfig({ supportedChains: [hardhatChain] });
    const client = hre.cofhe.createClient(config);

    await client.connect(hre.cofhe.publicClient, hre.cofhe.walletClient);

    expect(client.connected).to.be.true;
  });

  it('createClientWithBatteries uses the default account when no walletClient is provided', async () => {
    const client = await hre.cofhe.createClientWithBatteries();

    expect(client.connected).to.be.true;
    expect(client.config.environment).to.equal('hardhat');
  });

});
