import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import '@cofhe/hardhat-plugin';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env file from the root of the monorepo
dotenvConfig({ path: resolve(__dirname, '../../.env') });

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      evmVersion: 'cancun',
    },
  },
};

export default config;
