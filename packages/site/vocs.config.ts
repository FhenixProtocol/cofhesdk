import { defineConfig } from 'vocs'
import pkg from '../sdk/package.json'

export default defineConfig({
  title: 'Cofhe SDK Docs',
  titleTemplate: '%s - Cofhe SDK',
  description: 'Documentation for the Cofhe SDK',
  rootDir: '.',
  sidebar: [
    {
      text: 'Getting Started',
      link: '/getting-started',
    },
    {
      text: "Migrating from `cofhejs`",
      link: '/docs/migrating-from-cofhejs',
    },
    {
      text: 'Example',
      link: '/example',
    },
  ],
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
    { text: 'Docs', link: '/docs/getting-started', match: '/docs' },
    {
      text: 'Extensions',
      items: [
        {
          text: 'Account Abstraction',
          link: '/account-abstraction',
        },
        {
          text: 'OP Stack',
          link: '/op-stack',
        },
        {
          text: 'USDC (Circle)',
          link: '/circle-usdc',
        },
        {
          text: 'ZKsync',
          link: '/zksync',
        },
        {
          text: 'Experimental',
          link: '/experimental',
        },
      ],
    },
    {
      text: 'Examples',
      link: 'https://github.com/wevm/viem/tree/main/examples',
    },
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
})
