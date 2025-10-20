import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import '@cofhe/hardhat-plugin';

const config: HardhatUserConfig = {
  solidity: '0.8.28',
};

export default config;
