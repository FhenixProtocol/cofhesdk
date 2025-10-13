import { expect } from "chai";
import { describe, it } from "mocha";
import { TASK_COFHE_MOCKS_DEPLOY } from "../src/consts";
import { hardhat } from "@cofhesdk/chains";
import { useEnvironment } from "./helpers";

describe("CoFHE SDK Client Integration", () => {
  const getHre = useEnvironment("hardhat");

  it("should create a cofhesdk client", async () => {
    const hre = getHre();

    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Get a signer
    const [signer] = await hre.ethers.getSigners();

    // Create viem clients using the adapter
    const { publicClient, walletClient } =
      await hre.cofhesdk.hardhatSignerAdapter(signer);

    expect(publicClient).to.not.be.undefined;
    expect(walletClient).to.not.be.undefined;
    expect(publicClient.getChainId).to.not.be.undefined;
    expect(walletClient.getAddresses).to.not.be.undefined;
  });

  it("should create a cofhesdk config and client", async () => {
    const hre = getHre();

    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Get a signer
    const [signer] = await hre.ethers.getSigners();

    // Create viem clients using the adapter
    const { publicClient, walletClient } =
      await hre.cofhesdk.hardhatSignerAdapter(signer);

    // Create a basic input config for the cofhesdk
    const inputConfig = {
      supportedChains: [hardhat],
    };

    // Create the cofhesdk config (this will inject the zkv wallet client)
    const config = await hre.cofhesdk.createCofhesdkConfig(inputConfig);

    expect(config).to.not.be.undefined;
    expect(config.supportedChains).to.deep.equal([hardhat]);
    expect(config._internal?.zkvWalletClient).to.not.be.undefined;

    // Create the cofhesdk client from the config
    const client = hre.cofhesdk.createCofhesdkClient(config);

    expect(client).to.not.be.undefined;
    expect(client.config).to.equal(config);
  });

  it("should handle config creation with custom options", async () => {
    const hre = getHre();

    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Create input config with custom options
    const inputConfig = {
      supportedChains: [hardhat],
      fheKeysPrefetching: "OFF" as const,
      permitGeneration: "MANUAL" as const,
      defaultPermitExpiration: 3600, // 1 hour
      mocks: {
        sealOutputDelay: 100,
      },
    };

    // Create the cofhesdk config
    const config = await hre.cofhesdk.createCofhesdkConfig(inputConfig);

    expect(config).to.not.be.undefined;
    expect(config.supportedChains).to.deep.equal([hardhat]);
    expect(config.fheKeysPrefetching).to.equal("OFF");
    expect(config.permitGeneration).to.equal("MANUAL");
    expect(config.defaultPermitExpiration).to.equal(3600);
    expect(config.mocks.sealOutputDelay).to.equal(100);
    expect(config._internal?.zkvWalletClient).to.not.be.undefined;

    // Create client from config
    const client = hre.cofhesdk.createCofhesdkClient(config);
    expect(client).to.not.be.undefined;
    expect(client.config).to.equal(config);
  });

  it("should connect client with viem clients", async () => {
    const hre = getHre();

    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Get a signer
    const [signer] = await hre.ethers.getSigners();

    // Create viem clients using the adapter
    const { publicClient, walletClient } =
      await hre.cofhesdk.hardhatSignerAdapter(signer);

    // Create input config
    const inputConfig = {
      supportedChains: [hardhat],
    };

    // Create the cofhesdk config
    const config = await hre.cofhesdk.createCofhesdkConfig(inputConfig);

    // Create client from config
    const client = hre.cofhesdk.createCofhesdkClient(config);

    // Connect the client with viem clients
    await client.connect(publicClient, walletClient);

    expect(client.connected).to.be.true;
  });
});
