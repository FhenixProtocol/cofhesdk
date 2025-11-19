import { defineConfig } from 'vocs';
import pkg from './package.json';

export default defineConfig({
  title: 'Cofhe SDK Docs',
  titleTemplate: '%s - Cofhe SDK',
  description: 'Documentation for the Cofhe SDK',
  rootDir: '.',
  sidebar: {
    '/docs': [
      {
        text: 'Getting Started',
        link: '/docs',
      },
      {
        text: 'Migrating from `cofhejs`',
        link: '/docs/migrating-from-cofhejs',
      },
      {
        text: 'Example',
        link: '/docs/example',
      },
    ],
    '/hardhat': {
      backLink: true,
      items: [
        {
          text: 'Getting Started',
          link: '/hardhat',
        },
      ],
    },
    '/foundry': {
      backLink: true,
      items: [
        {
          text: 'Getting Started',
          link: '/foundry/getting-started',
        },
      ],
    },
    '/react': {
      backLink: true,
      items: [
        {
          text: 'Getting Started',
          link: '/react/getting-started',
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
    { text: 'Docs', link: './docs', match: '/docs' },
    { text: 'Hardhat', link: './hardhat', match: '/hardhat' },
    { text: 'Foundry', link: './foundry/getting-started', match: '/foundry' },
    { text: 'React', link: './react/getting-started', match: '/react' },
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
