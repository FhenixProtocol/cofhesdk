import { resetHardhatContext } from "hardhat/plugins-testing";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";
import { beforeEach, afterEach } from "vitest";

// Extend the HardhatRuntimeEnvironment to include ethers and cofhesdk
declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    ethers: any;
    cofhesdk: any;
  }
}

export function useEnvironment(fixtureProjectName: string) {
  let hre: HardhatRuntimeEnvironment;

  beforeEach(async () => {
    console.log("fixtureProjectName", fixtureProjectName);
    process.chdir(path.join(__dirname, "fixture-projects", fixtureProjectName));
    console.log("process.cwd()", process.cwd());

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hre = require("hardhat");
    console.log("hre loaded successfully");
  });

  afterEach(() => {
    resetHardhatContext();
  });

  return () => hre;
}
