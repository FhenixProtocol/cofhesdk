import hre from 'hardhat';
import { expect } from 'chai';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';

const logOpsAbi = [
  { name: 'logOps', type: 'function', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
] as const;

async function getLogOps(): Promise<boolean> {
  return hre.cofhe.publicClient.readContract({
    address: TASK_MANAGER_ADDRESS,
    abi: logOpsAbi,
    functionName: 'logOps',
  });
}

describe('Set Log Ops', () => {
  beforeEach(async () => {
    await hre.cofhe.mocks.disableLogs();
  });

  it('enableLogs sets logOps to true', async () => {
    expect(await getLogOps()).to.be.false;
    await hre.cofhe.mocks.enableLogs();
    expect(await getLogOps()).to.be.true;
  });

  it('disableLogs sets logOps to false', async () => {
    await hre.cofhe.mocks.enableLogs();
    expect(await getLogOps()).to.be.true;
    await hre.cofhe.mocks.disableLogs();
    expect(await getLogOps()).to.be.false;
  });

  it('withLogs enables during closure and restores after', async () => {
    expect(await getLogOps()).to.be.false;

    await hre.cofhe.mocks.withLogs('test-closure', async () => {
      expect(await getLogOps()).to.be.true;
    });

    expect(await getLogOps()).to.be.false;
  });
});
