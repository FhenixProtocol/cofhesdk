import hre from 'hardhat';
import { expect } from 'chai';
import type { SharedSimpleTest } from '../typechain-types/contracts/SharedSimpleTest';

async function deploySharedSimpleTest(): Promise<SharedSimpleTest> {
  const factory = await hre.ethers.getContractFactory('SharedSimpleTest');
  const simpleTest = (await factory.deploy()) as SharedSimpleTest;
  await simpleTest.waitForDeployment();
  return simpleTest;
}

describe('Adjusted Gas', () => {
  it('Should report a full breakdown for a tx with FHE ops', async () => {
    const simpleTest = await deploySharedSimpleTest();
    const tx = await simpleTest.setValueTrivial(7);
    const receipt = await tx.wait();

    const breakdown = hre.cofhe.getAdjustedGasBreakdown(receipt!);

    expect(breakdown.mockGasEvents).to.be.greaterThan(0);
    expect(breakdown.mockGas > 0n).to.equal(true, 'mockGas should be non-zero for FHE ops');
    expect(breakdown.gasUsed).to.equal(receipt!.gasUsed);
    expect(breakdown.adjustedGasUsed).to.equal(breakdown.gasUsed - breakdown.mockGas);
    expect(breakdown.adjustedGasUsed < breakdown.gasUsed).to.equal(true, 'adjusted should be below raw gasUsed');
  });

  it('Should match getAdjustedGasUsed with the breakdown', async () => {
    const simpleTest = await deploySharedSimpleTest();
    const tx = await simpleTest.setValueTrivial(9);
    const receipt = await tx.wait();

    const adjusted = hre.cofhe.getAdjustedGasUsed(receipt!);
    const breakdown = hre.cofhe.getAdjustedGasBreakdown(receipt!);
    expect(adjusted).to.equal(breakdown.adjustedGasUsed);
  });

  it('Should include mock logging cost in the adjustment when logging is enabled', async () => {
    const simpleTest = await deploySharedSimpleTest();

    // The exact same call three times: a warm-up, then logging off, then logging on.
    // Reusing one value keeps every storage slot (contract storage, ACL, mock storage -
    // trivialEncrypt ctHashes are value-derived and global) warm for both measured calls,
    // so logging is the only difference between them.
    const value = 424_242;
    await simpleTest.setValueTrivial(value);

    const txOff = await simpleTest.setValueTrivial(value);
    const receiptOff = await txOff.wait();
    const breakdownOff = hre.cofhe.getAdjustedGasBreakdown(receiptOff!);

    await hre.cofhe.mocks.enableLogs();
    const txOn = await simpleTest.setValueTrivial(value);
    const receiptOn = await txOn.wait();
    await hre.cofhe.mocks.disableLogs();
    const breakdownOn = hre.cofhe.getAdjustedGasBreakdown(receiptOn!);

    expect(breakdownOn.mockGas > breakdownOff.mockGas).to.equal(true, 'logging should increase tracked mock gas');
    const diff =
      breakdownOn.adjustedGasUsed > breakdownOff.adjustedGasUsed
        ? breakdownOn.adjustedGasUsed - breakdownOff.adjustedGasUsed
        : breakdownOff.adjustedGasUsed - breakdownOn.adjustedGasUsed;
    expect(diff < 10_000n).to.equal(true, `adjusted gas should be insensitive to logging (diff ${diff})`);
  });

  it('Should return raw gasUsed for a receipt without FHE ops', async () => {
    const [signer, other] = await hre.ethers.getSigners();
    const tx = await signer.sendTransaction({ to: other.address, value: 1n });
    const receipt = await tx.wait();

    expect(hre.cofhe.getAdjustedGasUsed(receipt!)).to.equal(receipt!.gasUsed);
    expect(hre.cofhe.getAdjustedGasBreakdown(receipt!).mockGasEvents).to.equal(0);
  });
});

describe('Adjusted Gas — audit regressions', () => {
  it('Should clamp adjustedGasUsed at zero for pathological receipts', () => {
    // Synthetic receipt where reported mock gas exceeds (post-refund) gasUsed.
    const { TASK_MANAGER_ADDRESS } = require('@cofhe/sdk');
    const { MOCK_GAS_CONSUMED_TOPIC } = require('@cofhe/hardhat-plugin');
    const fakeReceipt = {
      gasUsed: 1_000n,
      logs: [
        {
          address: TASK_MANAGER_ADDRESS,
          topics: [MOCK_GAS_CONSUMED_TOPIC],
          data: '0x' + 5_000n.toString(16).padStart(64, '0'),
        },
      ],
    };
    const breakdown = hre.cofhe.getAdjustedGasBreakdown(fakeReceipt);
    expect(breakdown.mockGas).to.equal(5_000n);
    expect(breakdown.adjustedGasUsed).to.equal(0n);
    expect(hre.cofhe.getAdjustedGasUsed(fakeReceipt)).to.equal(0n);
  });

  it('Should keep emitting MockGasConsumed when mockGasExcluded is set on hardhat', async () => {
    // setMockGasExcluded(true) enables the forge cheatcode shim; on hardhat the cheatcode
    // address has no code, so the shim must fall through to the event path rather than
    // silently disabling adjusted-gas reporting.
    const taskManager = await hre.cofhe.mocks.getMockTaskManager();
    await (await taskManager.setMockGasExcluded(true)).wait();
    try {
      const simpleTest = await deploySharedSimpleTest();
      const tx = await simpleTest.setValueTrivial(13);
      const receipt = await tx.wait();
      const breakdown = hre.cofhe.getAdjustedGasBreakdown(receipt!);
      expect(breakdown.mockGasEvents).to.be.greaterThan(0);
      expect(breakdown.mockGas > 0n).to.equal(true);
    } finally {
      await (await taskManager.setMockGasExcluded(false)).wait();
    }
  });
});
