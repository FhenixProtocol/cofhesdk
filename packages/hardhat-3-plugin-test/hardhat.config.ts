import { defineConfig } from 'hardhat/config';
import cofhePlugin from '@cofhe/hardhat-3-plugin';
import hardhatViem from '@nomicfoundation/hardhat-viem';
import hardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';

export default defineConfig({
  plugins: [cofhePlugin, hardhatViem, hardhatNodeTestRunner],
  cofhe: {
    mocksDeployVerbosity: 'v',
  },
});
