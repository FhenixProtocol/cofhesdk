import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
        deployTestBed: true,
        gasWarning: false,
        mocksDeployVerbosity: '',
      }
    );

    assert.ok(true);
  });
});
