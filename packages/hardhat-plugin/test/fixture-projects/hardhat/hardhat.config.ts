// We load the plugin here.
import { type HardhatUserConfig } from 'hardhat/types';
import '@nomicfoundation/hardhat-ethers';

import '../../../src';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.25',
    settings: {
      evmVersion: 'cancun',
    },
  },
  defaultNetwork: 'hardhat',

  paths: {
    // newPath: "asd",
  },
};

export default config;
