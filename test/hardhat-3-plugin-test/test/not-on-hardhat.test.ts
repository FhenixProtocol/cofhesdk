import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { MOCKS_TASK_MANAGER_ADDRESS } from '@cofhe/sdk';
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

  it('does not probe or deploy mocks automatically on arbitrary HTTP networks', async () => {
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
            localcofhe: {
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

      for (const networkName of ['remote', 'localcofhe']) {
        const connection = await hre.network.connect(networkName);
        await connection.close();
      }

      const matchingPresetMethods: string[] = [];
      const matchingPresetServer = createServer(async (request, response) => {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw);
        matchingPresetMethods.push(body.method);
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32601, message: 'method not supported by test server' },
          })
        );
      });
      await new Promise<void>((resolve) => matchingPresetServer.listen(42069, '127.0.0.1', resolve));
      try {
        const matchingPresetHre = await createHardhatRuntimeEnvironment(
          {
            solidity: { version: '0.8.28' },
            plugins: [cofhePlugin],
            networks: {
              localcofhe: {
                type: 'http',
                url: 'http://127.0.0.1:42069',
                chainId: 1,
                accounts: [generatePrivateKey()],
              },
            },
          },
          {},
          process.cwd()
        );
        const matchingPresetConnection = await matchingPresetHre.network.connect('localcofhe');
        await matchingPresetConnection.close();
      } finally {
        await new Promise<void>((resolve, reject) =>
          matchingPresetServer.close((error) => (error === undefined ? resolve() : reject(error)))
        );
      }

      assert.deepEqual(matchingPresetMethods, []);

      assert.equal(methods.includes('hardhat_metadata'), false);
      assert.equal(methods.includes('hardhat_setCode'), false);
      assert.equal(methods.includes('eth_sendRawTransaction'), false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error)))
      );
    }
  });

  it('updates mock descriptors after explicit deployment on an HTTP connection', async () => {
    const backendHre = await createHardhatRuntimeEnvironment({ solidity: { version: '0.8.28' } }, {}, process.cwd());
    const backend = await backendHre.network.connect();
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    await (backend.provider as any).request({
      method: 'hardhat_setBalance',
      params: [account.address, '0x56BC75E2D63100000'],
    });

    let rejectMetadata = false;
    const server = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      try {
        if (rejectMetadata && body.method === 'hardhat_metadata') {
          throw Object.assign(new Error('metadata temporarily unavailable'), { code: -32601 });
        }
        const result = await (backend.provider as any).request({ method: body.method, params: body.params ?? [] });
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      } catch (error: any) {
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: error?.code ?? -32000, message: error?.message ?? String(error) },
          })
        );
      }
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
              chainId: 31337,
              accounts: [privateKey],
            },
          },
        },
        {},
        process.cwd()
      );
      const connection = await hre.network.connect('remote');
      assert.equal(connection.cofhe.mocks.MockTaskManager.address, undefined);

      await connection.cofhe.mocks.deployMocks({ gasWarning: false, mocksDeployVerbosity: '' });

      assert.equal(connection.cofhe.mocks.MockTaskManager.address, MOCKS_TASK_MANAGER_ADDRESS);
      assert.ok(connection.cofhe.mocks.MockACL.address);
      const deployedAclAddress = connection.cofhe.mocks.MockACL.address;

      rejectMetadata = true;
      await connection.cofhe.mocks.deployMocks({ gasWarning: false, mocksDeployVerbosity: '' });
      assert.equal(connection.cofhe.mocks.MockTaskManager.address, MOCKS_TASK_MANAGER_ADDRESS);
      assert.equal(connection.cofhe.mocks.MockACL.address, deployedAclAddress);
      await connection.close();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error)))
      );
      await backend.close();
    }
  });
});
