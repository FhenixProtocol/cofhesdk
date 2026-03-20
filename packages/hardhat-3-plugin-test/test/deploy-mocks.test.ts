import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_THRESHOLD_NETWORK_ADDRESS,
  TEST_BED_ADDRESS,
} from '@cofhe/sdk';

describe('Deploy Mocks', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const hasCode = async (address: `0x${string}`) => {
    const code = await publicClient.getCode({ address });
    return !!code && code.length > 2;
  };

  it('MockTaskManager is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.MockTaskManager;
    assert.equal(address.toLowerCase(), TASK_MANAGER_ADDRESS.toLowerCase());
    assert.ok(await hasCode(address));
  });

  it('MockACL is deployed and its address matches TaskManager.acl()', async () => {
    const { address } = await cofhe.mocks.MockACL();
    const aclFromTm = await publicClient.readContract({
      ...cofhe.mocks.MockTaskManager,
      functionName: 'acl',
    });
    assert.equal(address.toLowerCase(), (aclFromTm as string).toLowerCase());
    assert.ok(await hasCode(address));
  });

  it('MockZkVerifier is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.MockZkVerifier;
    assert.equal(address.toLowerCase(), MOCKS_ZK_VERIFIER_ADDRESS.toLowerCase());
    assert.ok(await hasCode(address));
  });

  it('MockThresholdNetwork is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.MockThresholdNetwork;
    assert.equal(address.toLowerCase(), MOCKS_THRESHOLD_NETWORK_ADDRESS.toLowerCase());
    assert.ok(await hasCode(address));
  });

  it('TestBed is deployed at the expected fixed address', async () => {
    const { address } = cofhe.mocks.TestBed;
    assert.equal(address.toLowerCase(), TEST_BED_ADDRESS.toLowerCase());
    assert.ok(await hasCode(address));
  });
});
