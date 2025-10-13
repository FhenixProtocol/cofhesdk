import chalk from "chalk";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const hardhatSetCode = async (
  hre: HardhatRuntimeEnvironment,
  address: string,
  bytecode: string,
) => {
  await hre.network.provider.send("hardhat_setCode", [address, bytecode]);
};

// Network

export const checkNetworkAndSkip = async (hre: HardhatRuntimeEnvironment) => {
  const network = hre.network.name;
  const isHardhat = network === "hardhat";
  if (!isHardhat)
    logSuccess(
      `cofhe-hardhat-plugin - deploy mocks - skipped on non-hardhat network ${network}`,
      0,
    );
  return isHardhat;
};

// Logging

export const logEmpty = () => {
  console.log("");
};

export const logSuccess = (message: string, indent = 1) => {
  console.log(chalk.green(`${"  ".repeat(indent)}✓ ${message}`));
};

export const logWarning = (message: string, indent = 1) => {
  console.log(
    chalk.bold(chalk.yellow(`${"  ".repeat(indent)}⚠ NOTE:`)),
    message,
  );
};

export const logError = (message: string, indent = 1) => {
  console.log(chalk.red(`${"  ".repeat(indent)}✗ ${message}`));
};

export const logDeployment = (contractName: string, address: string) => {
  const paddedName = `${contractName} deployed`.padEnd(36);
  logSuccess(`${paddedName} ${chalk.bold(address)}`);
};
