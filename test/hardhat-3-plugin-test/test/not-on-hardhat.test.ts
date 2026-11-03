import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { generatePrivateKey } from 'viem/accounts';
import cofhePlugin from '@cofhe/hardhat-3-plugin';
import { deployMocks } from '@cofhe/hardhat-3-plugin';

describe('Deploy Mocks – non-hardhat', () => {
  it('deployMocks is a no-op on non-hardhat networks', async () => {
    const publicClient = {
      request: async () => {
        throw new Error('hardhat_metadata not supported');
      },
    } as any;

    // If deployMocks tries to actually deploy, it will need wallet access.
    const walletClient = {
      getAddresses: async () => {
        throw new Error('walletClient should not be used on non-hardhat');
      },
    } as any;

    await deployMocks(
      { publicClient, walletClient },
      {
        gasWarning: false,
        mocksDeployVerbosity: '',
      }
    );

    assert.ok(true);
  });

  it('does not probe or send transactions when connecting to an HTTP network', async () => {
    const methods: string[] = [];
    const server = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      methods.push(body.method);

      const results: Record<string, unknown> = {
        eth_chainId: '0x1',
        net_version: '1',
        hardhat_metadata: {},
      };
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          ...(body.method in results
            ? { result: results[body.method] }
            : { error: { code: -32000, message: 'unexpected request' } }),
        })
      );
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');

    try {
      const hre = await createHardhatRuntimeEnvironment(
        {
          solidity: { version: '0.8.28' },
          plugins: [cofhePlugin],
          networks: {
            remote: {
              type: 'http',
              url: `http://127.0.0.1:${address.port}`,
              chainId: 1,
              accounts: [generatePrivateKey()],
            },
          },
        },
        {},
        process.cwd()
      );

      const connection = await hre.network.connect('remote');
      await connection.close();

      assert.equal(
        methods.some((method) => method.startsWith('hardhat_')),
        false
      );
      assert.equal(methods.includes('eth_sendTransaction'), false);
      assert.equal(methods.includes('eth_sendRawTransaction'), false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error)))
      );
    }
  });
});
