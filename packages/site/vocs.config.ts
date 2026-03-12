import { defineConfig } from 'vocs';
import pkg from './package.json';

export default defineConfig({
  twoslash: {
    compilerOptions: {
      // ModuleResolutionKind.Bundler = 100
      // Required so twoslash can resolve package.json `exports` subpaths
      // (e.g. @cofhe/sdk/web, @cofhe/sdk/chains, viem/chains).
      // Without this, twoslash defaults to `node` resolution which ignores
      // the `exports` field, causing every subpath import to resolve as `any`.
      moduleResolution: 100,
    },
  },
  title: 'Cofhe SDK Docs',
  titleTemplate: '%s - Cofhe SDK',
  description: 'Documentation for the Cofhe SDK',
  rootDir: '.',
  sidebar: {
    '/': [
      {
        text: 'Intro',
        link: '/',
      },
      {
        text: 'Quick Start',
        link: '/quick-start',
      },
      {
        text: 'EncryptedCounter.sol',
        link: '/encrypted-counter-sol',
      },
      {
        text: 'Migrating from `cofhejs`',
        link: '/migrating-from-cofhejs',
      },
      {
        text: 'SDK',
        items: [
          {
            text: 'Client',
            link: '/sdk/client',
          },
          {
            text: 'Permits',
            link: '/sdk/permits',
          },
          {
            text: 'Encrypting Inputs',
            link: '/sdk/encrypting-inputs',
          },
          {
            text: 'Decrypting to View',
            link: '/sdk/decrypt-to-view',
          },
          {
            text: 'Decrypting to Transact',
            link: '/sdk/decrypt-to-tx',
          },
        ],
      },
      {
        text: 'Hardhat',
        items: [
          {
            text: 'Getting Started',
            link: '/hardhat',
          },
          {
            text: 'Mock Contracts',
            link: '/hardhat/mock-contracts',
          },
          {
            text: 'Client',
            link: '/hardhat/client',
          },
          {
            text: 'Logging',
            link: '/hardhat/logging',
          },
          {
            text: 'Testing',
            link: '/hardhat/testing',
          },
        ],
      },
    ],
    '/foundry': {
      backLink: true,
      items: [
        {
          text: 'Coming Soon',
          link: '/foundry',
        },
      ],
    },
    '/react': {
      backLink: true,
      items: [
        {
          text: 'Coming Soon',
          link: '/react',
        },
      ],
    },
  },
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/fhenixprotocol/cofhesdk',
    },
    {
      icon: 'discord',
      link: 'https://discord.gg/fhenix',
    },
    {
      icon: 'x',
      link: 'https://x.com/fhenix',
    },
  ],
  topNav: [
    { text: 'Docs', link: '/', match: '/' },
    { text: 'React', link: '/react', match: '/react' },
    {
      text: `v${pkg.version}`,
      items: [
        {
          text: 'Changelog',
          link: 'https://github.com/wevm/viem/blob/main/src/CHANGELOG.md',
        },
        {
          text: 'Contributing',
          link: 'https://github.com/wevm/viem/blob/main/.github/CONTRIBUTING.md',
        },
      ],
    },
  ],
});
