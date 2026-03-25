import { defineConfig } from 'vocs';
import pkg from './package.json';

const defaultBaseUrl = 'https://cofhesdk.fhenix.io';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const envBaseUrl = process.env.VOCS_BASE_URL;

const baseUrl = (envBaseUrl || defaultBaseUrl).replace(/\/+$/, '');

const ogLogoUrl = `${baseUrl}/fhenix-logo-word.svg`;

const ogImageUrl = {
  '/': `https://vocs.dev/api/og?logo=${ogLogoUrl}&title=%title&description=%description`,
};

export default defineConfig({
  baseUrl,
  iconUrl: '/favicon.png',
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
  ogImageUrl,
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
            text: 'Encryption',
            items: [
              {
                text: 'Encrypting Inputs',
                link: '/sdk/encrypting-inputs',
              },
              {
                text: 'Writing Encrypted Data to Contract',
                link: '/sdk/writing-encrypted-data-to-contract',
              },
            ],
          },
          {
            text: 'Decryption',
            items: [
              {
                text: 'Permits',
                link: '/sdk/permits',
              },
              {
                text: 'Decrypting to View',
                link: '/sdk/decrypt-to-view',
              },
              {
                text: 'Decrypting to Transact',
                link: '/sdk/decrypt-to-tx',
              },
              {
                text: 'Verifying Decrypt Results',
                link: '/sdk/verify-decrypt-result',
              },
              {
                text: 'Writing Decrypt Result to Contract',
                link: '/sdk/writing-decrypt-result-to-contract',
              },
            ],
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
      {
        text: 'Reference',
        items: [
          {
            text: 'Dictionary',
            link: '/reference/dictionary',
          },
          {
            text: 'EncryptedCounter.sol',
            link: '/reference/encrypted-counter-sol',
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
          link: 'https://github.com/FhenixProtocol/cofhesdk/releases',
        },
      ],
    },
  ],
});
