import { expect } from 'chai';
import { hardhat } from '@cofhe/sdk/chains';
import { TASK_COFHE_MOCKS_DEPLOY } from './consts';
import hre from 'hardhat';

describe('CoFHE SDK Client Integration', () => {
  it('should create a cofhe client', async () => {
    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Get a signer
    const [signer] = await hre.ethers.getSigners();

    // Create viem clients using the adapter
    const { publicClient, walletClient } = await hre.cofhe.hardhatSignerAdapter(signer);

    expect(publicClient).to.not.be.undefined;
    expect(walletClient).to.not.be.undefined;
    expect(publicClient.getChainId).to.not.be.undefined;
    expect(walletClient.getAddresses).to.not.be.undefined;
  });

  it('should create a @cofhe/sdk config and client', async () => {
    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Create a basic input config for the cofhe
    const inputConfig = {
      supportedChains: [hardhat],
    };

    // Create the cofhe config (this will inject the zkv wallet client)
    const config = await hre.cofhe.createConfig(inputConfig);

    expect(config).to.not.be.undefined;
    expect(config.supportedChains).to.deep.equal([hardhat]);
    expect(config.environment).to.equal('hardhat');
    expect(config._internal?.zkvWalletClient).to.not.be.undefined;

    // Create the cofhe client from the config
    const client = hre.cofhe.createClient(config);

    expect(client).to.not.be.undefined;
    expect(client.config).to.equal(config);
  });

  it('should handle config creation with custom options', async () => {
    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Create input config with custom options
    const inputConfig = {
      supportedChains: [hardhat],
      defaultPermitExpiration: 3600, // 1 hour
      mocks: {
        decryptDelay: 100,
      },
    };

    // Create the cofhe config
    const config = await hre.cofhe.createConfig(inputConfig);

    expect(config).to.not.be.undefined;
    expect(config.supportedChains).to.deep.equal([hardhat]);
    expect(config.environment).to.equal('hardhat');
    expect(config.defaultPermitExpiration).to.equal(3600);
    expect(config.mocks.decryptDelay).to.equal(100);
    expect(config._internal?.zkvWalletClient).to.not.be.undefined;

    // Create the cofhe client from the config
    const client = hre.cofhe.createClient(config);
    expect(client).to.not.be.undefined;
    expect(client.config).to.equal(config);
  });

  it('should connect client with viem clients', async () => {
    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Get a signer
    const [signer] = await hre.ethers.getSigners();

    // Create viem clients using the adapter
    const { publicClient, walletClient } = await hre.cofhe.hardhatSignerAdapter(signer);

    // Create input config
    const inputConfig = {
      supportedChains: [hardhat],
    };

    // Create the cofhe config
    const config = await hre.cofhe.createConfig(inputConfig);

    // Create client from config
    const client = hre.cofhe.createClient(config);

    // Connect the client with viem clients
    await client.connect(publicClient, walletClient);

    expect(client.connected).to.be.true;
  });
});
