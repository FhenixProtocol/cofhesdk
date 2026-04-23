/**
 * Verifies that revert errors from deployed mock contracts are surfaced with
 * their human-readable names rather than raw hex selectors.
 *
 * The plugin compiles the mock contracts via a stub import file so their
 * artifacts are registered in Hardhat's build system — enabling automatic
 * error decoding for both fixed-address and normally-deployed mock contracts.
 */

import hre from 'hardhat';
import { expect } from 'chai';
import { Interface, ZeroAddress, zeroPadBytes, getBytes } from 'ethers';
import { MockACLArtifact } from '@cofhe/mock-contracts';

describe('Contract and Error Decoding (hardhat is aware of mock contracts)', () => {
  it('artifact exists for fixed-address mock (MockTaskManager)', async () => {
    const exists = await hre.artifacts.artifactExists('MockTaskManager');
    expect(exists).to.equal(true);
  });

  it('artifact exists for variable-address mock (MockACL)', async () => {
    const exists = await hre.artifacts.artifactExists('MockACL');
    expect(exists).to.equal(true);
  });

  it('readArtifact resolves MockTaskManager with a non-empty ABI', async () => {
    const artifact = await hre.artifacts.readArtifact('MockTaskManager');
    expect(artifact.contractName).to.equal('MockTaskManager');
    expect(artifact.abi).to.be.an('array').with.length.greaterThan(0);
  });

  it('readArtifact resolves MockACL with a non-empty ABI', async () => {
    const artifact = await hre.artifacts.readArtifact('MockACL');
    expect(artifact.contractName).to.equal('MockACL');
    expect(artifact.abi).to.be.an('array').with.length.greaterThan(0);
  });

  it('readContract error message contains decoded error "PermissionInvalid_Expired"', async () => {
    const acl = await hre.cofhe.mocks.getMockACL();
    const aclAddress = await acl.getAddress();

    const expiredPermission = {
      issuer: ZeroAddress,
      expiration: 0n,
      recipient: ZeroAddress,
      validatorId: 0n,
      validatorContract: ZeroAddress,
      sealingKey: zeroPadBytes('0x', 32),
      issuerSignature: '0x',
      recipientSignature: '0x',
    };

    const iface = new Interface(MockACLArtifact.abi);
    const calldata = iface.encodeFunctionData('checkPermitValidity', [expiredPermission]);

    try {
      await hre.ethers.provider.call({ to: aclAddress, data: calldata });
      expect.fail('Expected the call to revert');
    } catch (err: any) {
      const revertData = extractRevertData(err);
      expect(revertData).to.not.be.null;
      const decoded = iface.parseError(getBytes(revertData!));
      expect(decoded?.name).to.equal('PermissionInvalid_Expired');
    }
  });

  it('writeContract error message contains decoded error "OnlyOwnerAllowed"', async () => {
    const taskManager = await hre.cofhe.mocks.getMockTaskManager();
    const [, nonOwner] = await hre.ethers.getSigners();

    try {
      await taskManager.connect(nonOwner).setVerifierSigner(nonOwner.address);
      expect.fail('Expected the call to revert');
    } catch (err: any) {
      expect(err.message).to.include('OnlyOwnerAllowed');
      expect(err.message).to.include(await nonOwner.getAddress());
    }
  });
});

function extractRevertData(err: any): string | null {
  if (typeof err.data === 'string' && err.data.startsWith('0x')) return err.data;
  if (typeof err.error?.data === 'string' && err.error.data.startsWith('0x')) return err.error.data;
  if (typeof err.info?.error?.data === 'string') return err.info.error.data;
  const match = err.message?.match(/data="(0x[0-9a-fA-F]+)"/);
  return match ? match[1] : null;
}
