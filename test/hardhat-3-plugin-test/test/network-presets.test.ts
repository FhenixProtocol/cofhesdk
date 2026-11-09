import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

describe('Network presets', () => {
  it('connects to the localcofhe preset with its accounts', async () => {
    // No localcofhe node is needed: the preset's accounts are local, so eth_accounts is answered
    // without a request, and the mocks deployment is skipped on a network that isn't Hardhat.
    const connection = await network.connect('localcofhe');
    try {
      assert.equal(connection.networkName, 'localcofhe');
      const accounts = await connection.provider.request({ method: 'eth_accounts' });
      assert.deepEqual(accounts, [
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
        '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
        '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
      ]);
    } finally {
      await connection.close();
    }
  });
});
