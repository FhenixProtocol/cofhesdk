import hre from 'hardhat';
import { expect } from 'chai';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_THRESHOLD_NETWORK_ADDRESS,
  TEST_BED_ADDRESS,
} from '@cofhe/sdk';

async function hasCode(address: `0x${string}`): Promise<boolean> {
  const code = await hre.cofhe.publicClient.getCode({ address });
  return !!code && code.length > 2;
}

describe('Deploy Mocks', () => {
  it('MockTaskManager is deployed at the expected fixed address', async () => {
    const tm = await hre.cofhe.mocks.getMockTaskManager();
    expect(tm.address.toLowerCase()).to.equal(TASK_MANAGER_ADDRESS.toLowerCase());
    expect(await hasCode(tm.address)).to.be.true;
  });

  it('MockACL is deployed and its address matches TaskManager.acl()', async () => {
    const tm = await hre.cofhe.mocks.getMockTaskManager();
    const acl = await hre.cofhe.mocks.getMockACL();

    const aclAddressFromTm = await hre.cofhe.publicClient.readContract({
      address: tm.address,
      abi: [
        {
          name: 'acl',
          type: 'function',
          inputs: [],
          outputs: [{ type: 'address' }],
          stateMutability: 'view',
        },
      ] as const,
      functionName: 'acl',
    });

    expect(acl.address.toLowerCase()).to.equal(aclAddressFromTm.toLowerCase());
    expect(await hasCode(acl.address)).to.be.true;
  });

  it('MockZkVerifier is deployed at the expected fixed address', async () => {
    const zkv = await hre.cofhe.mocks.getMockZkVerifier();
    expect(zkv.address.toLowerCase()).to.equal(MOCKS_ZK_VERIFIER_ADDRESS.toLowerCase());
    expect(await hasCode(zkv.address)).to.be.true;
  });

  it('MockThresholdNetwork is deployed at the expected fixed address', async () => {
    const tn = await hre.cofhe.mocks.getMockThresholdNetwork();
    expect(tn.address.toLowerCase()).to.equal(MOCKS_THRESHOLD_NETWORK_ADDRESS.toLowerCase());
    expect(await hasCode(tn.address)).to.be.true;
  });

  it('TestBed is deployed at the expected fixed address', async () => {
    const tb = await hre.cofhe.mocks.getTestBed();
    expect(tb.address.toLowerCase()).to.equal(TEST_BED_ADDRESS.toLowerCase());
    expect(await hasCode(tb.address)).to.be.true;
  });
});
