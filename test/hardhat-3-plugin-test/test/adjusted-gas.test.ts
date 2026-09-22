import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';
import { MOCK_GAS_CONSUMED_TOPIC } from '@cofhe/hardhat-3-plugin';

describe('Adjusted Gas', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const simpleTest = await viem.deployContract('SharedSimpleTest', [], {
    client: {
      public: publicClient,
      wallet: walletClient,
    },
  });

  const setValueTrivial = async (value: number) => {
    const hash = await simpleTest.write.setValueTrivial([BigInt(value)]);
    return publicClient.waitForTransactionReceipt({ hash });
  };

  it('reports a full breakdown for a tx with FHE ops', async () => {
    const receipt = await setValueTrivial(7);

    const breakdown = cofhe.getAdjustedGasBreakdown(receipt);

    assert.ok(breakdown.mockGasEvents > 0, 'mockGasEvents should be non-zero for FHE ops');
    assert.ok(breakdown.mockGas > 0n, 'mockGas should be non-zero for FHE ops');
    assert.equal(breakdown.gasUsed, receipt.gasUsed);
    assert.equal(breakdown.adjustedGasUsed, breakdown.gasUsed - breakdown.mockGas);
    assert.ok(breakdown.adjustedGasUsed < breakdown.gasUsed, 'adjusted should be below raw gasUsed');
  });

  it('getAdjustedGasUsed matches the breakdown', async () => {
    const receipt = await setValueTrivial(9);

    const adjusted = cofhe.getAdjustedGasUsed(receipt);
    const breakdown = cofhe.getAdjustedGasBreakdown(receipt);
    assert.equal(adjusted, breakdown.adjustedGasUsed);
  });

  it('includes mock logging cost in the adjustment when logging is enabled', async () => {
    // The exact same call three times: a warm-up, then logging off, then logging on.
    // Reusing one value keeps every storage slot (contract storage, ACL, mock storage -
    // trivialEncrypt ctHashes are value-derived and global) warm for both measured calls,
    // so logging is the only difference between them.
    const value = 424_242;
    await setValueTrivial(value);

    const receiptOff = await setValueTrivial(value);
    const breakdownOff = cofhe.getAdjustedGasBreakdown(receiptOff);

    await cofhe.mocks.enableLogs();
    const receiptOn = await setValueTrivial(value);
    await cofhe.mocks.disableLogs();
    const breakdownOn = cofhe.getAdjustedGasBreakdown(receiptOn);

    assert.ok(breakdownOn.mockGas > breakdownOff.mockGas, 'logging should increase tracked mock gas');
    const diff =
      breakdownOn.adjustedGasUsed > breakdownOff.adjustedGasUsed
        ? breakdownOn.adjustedGasUsed - breakdownOff.adjustedGasUsed
        : breakdownOff.adjustedGasUsed - breakdownOn.adjustedGasUsed;
    assert.ok(diff < 10_000n, `adjusted gas should be insensitive to logging (diff ${diff})`);
  });

  it('returns raw gasUsed for a receipt without FHE ops', async () => {
    const [address] = await walletClient!.getAddresses();
    const hash = await walletClient!.sendTransaction({
      account: address!,
      to: address!,
      value: 1n,
      chain: null,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    assert.equal(cofhe.getAdjustedGasUsed(receipt), receipt.gasUsed);
    assert.equal(cofhe.getAdjustedGasBreakdown(receipt).mockGasEvents, 0);
  });
});

describe('Adjusted Gas — audit regressions', async () => {
  const { viem, cofhe } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const simpleTest = await viem.deployContract('SharedSimpleTest', [], {
    client: { public: publicClient, wallet: walletClient },
  });

  it('clamps adjustedGasUsed at zero for pathological receipts', () => {
    // Synthetic receipt where reported mock gas exceeds (post-refund) gasUsed.
    const fakeReceipt = {
      gasUsed: 1_000n,
      logs: [
        {
          address: TASK_MANAGER_ADDRESS,
          topics: [MOCK_GAS_CONSUMED_TOPIC],
          data: `0x${5_000n.toString(16).padStart(64, '0')}`,
        },
      ],
    };
    const breakdown = cofhe.getAdjustedGasBreakdown(fakeReceipt);
    assert.equal(breakdown.mockGas, 5_000n);
    assert.equal(breakdown.adjustedGasUsed, 0n);
    assert.equal(cofhe.getAdjustedGasUsed(fakeReceipt), 0n);
  });

  it('keeps emitting MockGasConsumed when mockGasExcluded is set on hardhat', async () => {
    // setMockGasExcluded(true) enables the forge cheatcode shim; on hardhat the cheatcode
    // address has no code, so the shim must fall through to the event path rather than
    // silently disabling adjusted-gas reporting.
    const setFlag = async (value: boolean) => {
      const hash = await walletClient!.writeContract({
        ...cofhe.mocks.MockTaskManager,
        functionName: 'setMockGasExcluded',
        args: [value],
        account: (await walletClient!.getAddresses())[0]!,
        chain: null,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    };

    await setFlag(true);
    try {
      const hash = await simpleTest.write.setValueTrivial([13n]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const breakdown = cofhe.getAdjustedGasBreakdown(receipt);
      assert.ok(breakdown.mockGasEvents > 0, 'events should still be emitted');
      assert.ok(breakdown.mockGas > 0n, 'mockGas should still be tracked');
    } finally {
      await setFlag(false);
    }
  });
});
