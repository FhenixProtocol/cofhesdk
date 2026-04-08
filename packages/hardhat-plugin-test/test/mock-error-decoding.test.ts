import hre from 'hardhat';
import { expect } from 'chai';
import { Interface, ZeroAddress, zeroPadBytes, getBytes } from 'ethers';
import { MockACLArtifact, MockTaskManagerArtifact } from '@cofhe/mock-contracts';

/**
 * Verifies that the @cofhe/hardhat-plugin correctly registers mock contract
 * artifacts in Hardhat's build system, so that:
 *
 *  - hre.artifacts.readArtifact() resolves for every mock contract
 *  - Hardhat can decode reverts from both fixed-address (setCode) and
 *    normally-deployed mock contracts
 *
 * The plugin achieves this by writing a stub Solidity file (inside the Hardhat
 * cache dir) that imports every contract from @cofhe/mock-contracts/contracts.
 * Hardhat then compiles those imports as regular node_modules dependencies,
 * and their artifacts end up in hre.artifacts like any other compiled contract.
 */
describe('Mock Contract Error Decoding (Replication)', () => {
  // -- Hardhat artifact awareness (THE FIX) --

  it('Hardhat has an artifact for fixed-address mock contracts (deployed via hardhat_setCode)', async () => {
    const exists = await hre.artifacts.artifactExists('MockTaskManager');
    expect(exists).to.equal(true, 'MockTaskManager artifact should exist — plugin registers it via stub compilation');
  });

  it('Hardhat has an artifact for non-fixed mock contracts', async () => {
    const exists = await hre.artifacts.artifactExists('MockACL');
    expect(exists).to.equal(true, 'MockACL artifact should exist — plugin registers it via stub compilation');
  });

  // -- Error decoding with ABI (works today via ethers) --

  it('Revert from MockACL IS decodable when caller has the ABI', async () => {
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
      console.log('MockACL Revert Error', err);
      // Extract the raw revert data from the error
      const revertData = extractRevertData(err);
      expect(revertData).to.not.be.null;

      // We CAN decode it because we have the ABI
      const decoded = iface.parseError(getBytes(revertData!));
      expect(decoded).to.not.be.null;
      expect(decoded!.name).to.equal('PermissionInvalid_Expired');
    }
  });

  // -- Raw error without ABI (the actual problem) --

  it('Without the ABI, revert data is just an opaque selector', async () => {
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

      // PermissionInvalid_Expired() has selector 0xed0764a1
      // Without the ABI, all a consumer sees is this raw hex
      expect(revertData!.startsWith('0xed0764a1')).to.be.true;

      // An Interface with NO error definitions cannot decode it
      const emptyIface = new Interface([]);
      const decoded = emptyIface.parseError(getBytes(revertData!));
      expect(decoded).to.be.null;
    }
  });

  // -- Fixed-address contract revert is now decodable by Hardhat --

  it('Fixed-address contract (MockTaskManager) revert is decodable — Hardhat knows its ABI', async () => {
    const taskManager = await hre.cofhe.mocks.getMockTaskManager();
    const tmAddress = await taskManager.getAddress();

    const [, nonOwner] = await hre.ethers.getSigners();

    const iface = new Interface(MockTaskManagerArtifact.abi);
    const calldata = iface.encodeFunctionData('setVerifierSigner', [nonOwner.address]);

    try {
      await nonOwner.call({ to: tmAddress, data: calldata });
      expect.fail('Expected the call to revert');
    } catch (err: any) {
      const revertData = extractRevertData(err);
      expect(revertData).to.not.be.null;

      const decoded = iface.parseError(getBytes(revertData!));
      expect(decoded).to.not.be.null;
      expect(decoded!.name).to.equal('OnlyOwnerAllowed');
    }
  });

  it('MockTaskManager revert is auto-decoded by ethers using the Hardhat-registered ABI', async () => {
    // getMockTaskManager() now uses hre.artifacts.readArtifact('MockTaskManager'), so the
    // returned contract instance carries the full ABI from Hardhat's build system.
    // When the call reverts, ethers decodes the custom error automatically — no manual
    // Interface.parseError() needed and no "(unknown contract)" in the Hardhat console.
    const taskManager = await hre.cofhe.mocks.getMockTaskManager();
    const [, nonOwner] = await hre.ethers.getSigners();

    try {
      await taskManager.connect(nonOwner).setVerifierSigner(nonOwner.address);
      expect.fail('Expected the call to revert');
    } catch (err: any) {
      // Hardhat decodes the revert using the registered artifact ABI and embeds the result
      // in the error message.  Before the fix this said "(unknown contract) threw unknown
      // error with signature 0x..."; now it names both the contract and the error.
      expect(err.message).to.include('OnlyOwnerAllowed');
      expect(err.message).to.include(await nonOwner.getAddress());
    }
  });

  // -- hre.artifacts.readArtifact works for all mock contracts --

  it('hre.artifacts.readArtifact resolves MockTaskManager (fixed-address / setCode)', async () => {
    const artifact = await hre.artifacts.readArtifact('MockTaskManager');
    expect(artifact.contractName).to.equal('MockTaskManager');
    expect(artifact.abi).to.be.an('array').with.length.greaterThan(0);
  });

  it('hre.artifacts.readArtifact resolves MockACL (non-fixed / ethers deploy)', async () => {
    const artifact = await hre.artifacts.readArtifact('MockACL');
    expect(artifact.contractName).to.equal('MockACL');
    expect(artifact.abi).to.be.an('array').with.length.greaterThan(0);
  });
});

/**
 * Extract raw revert data from various error formats (ethers v6 / Hardhat).
 */
function extractRevertData(err: any): string | null {
  // ethers v6: err.data contains the revert data directly
  if (typeof err.data === 'string' && err.data.startsWith('0x')) {
    return err.data;
  }

  // Nested in error.error.data
  if (err.error && typeof err.error.data === 'string' && err.error.data.startsWith('0x')) {
    return err.error.data;
  }

  // Hardhat provider error: look in err.info.error.data
  if (err.info?.error?.data && typeof err.info.error.data === 'string') {
    return err.info.error.data;
  }

  // Try parsing from the error message (some Hardhat versions embed it)
  const match = err.message?.match(/data="(0x[0-9a-fA-F]+)"/);
  if (match) {
    return match[1];
  }

  return null;
}
