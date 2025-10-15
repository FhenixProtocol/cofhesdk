/* eslint-disable no-unused-vars */
import path from 'path';
import { resetHardhatContext } from 'hardhat/plugins-testing';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import { beforeEach, afterEach } from 'mocha';

declare module 'mocha' {
  interface Context {
    hre: HardhatRuntimeEnvironment;
  }
}

export function useEnvironment(fixtureProjectName: string) {
  let hre: HardhatRuntimeEnvironment;

  beforeEach(async () => {
    console.log('fixtureProjectName', fixtureProjectName);
    process.chdir(path.join(__dirname, 'fixture-projects', fixtureProjectName));
    console.log('process.cwd()', process.cwd());

    hre = require('hardhat');
    console.log('hre loaded successfully');
  });

  afterEach(() => {
    resetHardhatContext();
  });

  return () => hre;
}
