import { resetHardhatContext } from "hardhat/plugins-testing";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import path from "path";

declare module "mocha" {
  interface Context {
    hre: HardhatRuntimeEnvironment;
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
