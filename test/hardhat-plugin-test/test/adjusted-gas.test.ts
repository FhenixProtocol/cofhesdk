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
