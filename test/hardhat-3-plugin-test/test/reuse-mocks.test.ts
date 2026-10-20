import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

// Every network.connect() runs deployMocks through the newConnection hook. On a chain that
// outlives one connection (an http `hardhat node` shared by scripts or test workers), deploying
// again would wire a fresh MockACL into the TaskManager and drop every permission granted so far.
describe('Reuse deployed mocks', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const getAcl = () => publicClient.readContract({ ...cofhe.mocks.MockTaskManager, functionName: 'acl' });

  it('reuseExisting keeps the ACL and the permissions it holds', async () => {
    const simpleTest = await viem.deployContract('SharedSimpleTest');
    await publicClient.waitForTransactionReceipt({ hash: await simpleTest.write.setValueTrivial([7n]) });
    await publicClient.waitForTransactionReceipt({ hash: await simpleTest.write.addValueTrivial([1n]) });
    const aclBefore = await getAcl();

    await cofhe.mocks.deployMocks({ reuseExisting: true, mocksDeployVerbosity: '' });

    assert.equal((await getAcl()).toLowerCase(), aclBefore.toLowerCase());
    // The contract can still operate on the handle it stored before.
    await publicClient.waitForTransactionReceipt({ hash: await simpleTest.write.addValueTrivial([1n]) });
  });

  it('deployMocks without reuseExisting still deploys a fresh set', async () => {
    const aclBefore = await getAcl();

    await cofhe.mocks.deployMocks({ mocksDeployVerbosity: '' });

    assert.notEqual((await getAcl()).toLowerCase(), aclBefore.toLowerCase());
  });
});
