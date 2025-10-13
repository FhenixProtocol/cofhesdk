import { describe, it, expect } from "vitest";
import { TASK_COFHE_MOCKS_DEPLOY } from "../../../src/consts";
import { hardhat } from "@cofhesdk/chains";
import hre from "hardhat";

// Import the plugin to inject the types
// import "../src";

describe("CoFHE SDK Client Integration", () => {
  it("should create a cofhesdk client", async () => {
    // Deploy mocks first
    await hre.run(TASK_COFHE_MOCKS_DEPLOY, { silent: true });

    // Get a signer
    const [signer] = await hre.ethers.getSigners();

    // Create viem clients using the adapter
    const { publicClient, walletClient } =
      await hre.cofhesdk.hardhatSignerAdapter(signer);

    expect(publicClient).toBeDefined();
    expect(walletClient).toBeDefined();
    expect(publicClient.getChainId).toBeDefined();
    expect(walletClient.getAddresses).toBeDefined();
  });

  it("should create a cofhesdk config and client", async () => {
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

    expect(config).toBeDefined();
    expect(config.supportedChains).toEqual([hardhat]);
    expect(config._internal?.zkvWalletClient).toBeDefined();

    // Create the cofhesdk client from the config
    const client = hre.cofhesdk.createCofhesdkClient(config);

    expect(client).toBeDefined();
    expect(client.config).toBe(config);
  });

  it("should handle config creation with custom options", async () => {
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

    expect(config).toBeDefined();
    expect(config.supportedChains).toEqual([hardhat]);
    expect(config.fheKeysPrefetching).toBe("OFF");
    expect(config.permitGeneration).toBe("MANUAL");
    expect(config.defaultPermitExpiration).toBe(3600);
    expect(config.mocks.sealOutputDelay).toBe(100);
    expect(config._internal?.zkvWalletClient).toBeDefined();

    // Create client from config
    const client = hre.cofhesdk.createCofhesdkClient(config);
    expect(client).toBeDefined();
    expect(client.config).toBe(config);
  });

  it("should connect client with viem clients", async () => {
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

    expect(client.connected).toBe(true);
  });
});
