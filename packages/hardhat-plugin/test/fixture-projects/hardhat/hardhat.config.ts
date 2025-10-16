import { type HardhatUserConfig } from 'hardhat/types';
import '@nomicfoundation/hardhat-ethers';

// Import the plugin
import '../../../src/index';

console.warn('imported plugin');

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.25',
    settings: {
      evmVersion: 'cancun',
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
  },
};

export default config;
