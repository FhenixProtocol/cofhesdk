import { defineConfig } from 'hardhat/config';
import cofhePlugin from '@cofhe/hardhat-3-plugin';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

export default defineConfig({
  plugins: [cofhePlugin, hardhatMocha],
  test: {
    mocha: {
      timeout: 60_000,
    },
  },
});
