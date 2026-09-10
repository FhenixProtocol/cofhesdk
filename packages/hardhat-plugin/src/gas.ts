import chalk from 'chalk';
import { ethers } from 'ethers';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

/// Topic of MockCoFHE's `MockGasConsumed(uint256)` event, emitted once per block of
/// mock-only work (op replication, decrypt-task storage, log building) with the gas it
/// consumed. Summing these per transaction gives the mock overhead of that transaction.
export const MOCK_GAS_CONSUMED_TOPIC = ethers.id('MockGasConsumed(uint256)');

/// Minimal receipt shape - compatible with ethers v6 TransactionReceipt and viem receipts.
export type AdjustableGasReceipt = {
  gasUsed: bigint | number | string;
  logs?: ReadonlyArray<{ address: string; topics: ReadonlyArray<string>; data: string }>;
};

export type AdjustedGasBreakdown = {
  /** Raw gas used by the transaction (includes mock overhead). */
  gasUsed: bigint;
  /** Gas consumed by mock-only work (FHE op replication, decrypt-task storage, mock logging). */
  mockGas: bigint;
  /** gasUsed - mockGas: an estimate of what the transaction would cost on a real CoFHE network. */
  adjustedGasUsed: bigint;
  /** Number of MockGasConsumed events - roughly the number of mock-only blocks executed. */
  mockGasEvents: number;
};

/// Computes the gas breakdown of a transaction receipt by summing the MockGasConsumed
/// events emitted by the mock task manager. Pure function of the receipt - no RPC calls.
/// On a real network (no mock events in the logs) `adjustedGasUsed` equals `gasUsed`.
export const mock_getAdjustedGasBreakdown = (receipt: AdjustableGasReceipt): AdjustedGasBreakdown => {
  let mockGas = 0n;
  let mockGasEvents = 0;

  for (const log of receipt.logs ?? []) {
    if (log.address.toLowerCase() === TASK_MANAGER_ADDRESS.toLowerCase() && log.topics[0] === MOCK_GAS_CONSUMED_TOPIC) {
      mockGas += BigInt(log.data);
      mockGasEvents += 1;
    }
  }

  const gasUsed = BigInt(receipt.gasUsed);
  return { gasUsed, mockGas, adjustedGasUsed: gasUsed - mockGas, mockGasEvents };
};

/// Returns the receipt's gas usage excluding mock overhead - an estimate of what the
/// transaction would cost on a real CoFHE network. See mock_getAdjustedGasBreakdown.
export const mock_getAdjustedGasUsed = (receipt: AdjustableGasReceipt): bigint =>
  mock_getAdjustedGasBreakdown(receipt).adjustedGasUsed;

// =====================
//  END-OF-RUN SUMMARY
// =====================

type MethodAggregate = {
  to: string;
  selector: string;
  calls: number;
  totalGasUsed: bigint;
  totalMockGas: bigint;
};

const shortAddress = (address: string) => `${address.slice(0, 6)}..${address.slice(-4)}`;

/// Builds a selector -> "signature" map from every compiled artifact so summary rows can
/// show method names instead of raw selectors.
const buildSelectorNameMap = async (hre: HardhatRuntimeEnvironment): Promise<Map<string, string>> => {
  const selectorNames = new Map<string, string>();
  for (const fqn of await hre.artifacts.getAllFullyQualifiedNames()) {
    try {
      const artifact = await hre.artifacts.readArtifact(fqn);
      const iface = new ethers.Interface(artifact.abi);
      iface.forEachFunction((fn) => {
        if (!selectorNames.has(fn.selector)) selectorNames.set(fn.selector, fn.format('sighash'));
      });
    } catch {
      // Artifacts without a usable ABI are skipped
    }
  }
  return selectorNames;
};

/// Resolves deployed addresses to contract names by matching on-chain code against
/// artifact deployedBytecode. Best effort: contracts with immutables won't match and
/// fall back to a shortened address.
const buildAddressNameMap = async (
  hre: HardhatRuntimeEnvironment,
  addresses: string[]
): Promise<Map<string, string>> => {
  const codeToName = new Map<string, string>();
  for (const fqn of await hre.artifacts.getAllFullyQualifiedNames()) {
    try {
      const artifact = await hre.artifacts.readArtifact(fqn);
      if (artifact.deployedBytecode && artifact.deployedBytecode !== '0x') {
        codeToName.set(artifact.deployedBytecode.toLowerCase(), artifact.contractName);
      }
    } catch {
      // skip
    }
  }

  const addressNames = new Map<string, string>();
  for (const address of addresses) {
    try {
      const code: string = await hre.network.provider.send('eth_getCode', [address, 'latest']);
      addressNames.set(address, codeToName.get(code.toLowerCase()) ?? shortAddress(address));
    } catch {
      addressNames.set(address, shortAddress(address));
    }
  }
  return addressNames;
};

/// Prints a per-method gas summary for every transaction that performed mock FHE work,
/// showing raw gas (as reported on the mock network) next to adjusted gas (an estimate of
/// real-network cost). Enabled via `cofhe: { gasSummary: true }` in the hardhat config;
/// runs after the test task completes.
export const printMockGasSummary = async (hre: HardhatRuntimeEnvironment) => {
  let logs: Array<{ transactionHash: string; data: string }>;
  try {
    logs = await hre.network.provider.send('eth_getLogs', [
      { fromBlock: '0x0', toBlock: 'latest', address: TASK_MANAGER_ADDRESS, topics: [MOCK_GAS_CONSUMED_TOPIC] },
    ]);
  } catch {
    return;
  }
  if (!logs || logs.length === 0) return;

  // Sum mock gas per transaction
  const mockGasPerTx = new Map<string, bigint>();
  for (const log of logs) {
    mockGasPerTx.set(log.transactionHash, (mockGasPerTx.get(log.transactionHash) ?? 0n) + BigInt(log.data));
  }

  // Aggregate per called contract + method
  const aggregates = new Map<string, MethodAggregate>();
  for (const [txHash, mockGas] of mockGasPerTx) {
    try {
      const receipt = await hre.network.provider.send('eth_getTransactionReceipt', [txHash]);
      const tx = await hre.network.provider.send('eth_getTransactionByHash', [txHash]);
      if (!receipt || !tx?.to) continue;

      const to = ethers.getAddress(tx.to);
      const selector = (tx.input ?? '0x').slice(0, 10);
      const key = `${to}:${selector}`;
      const aggregate = aggregates.get(key) ?? { to, selector, calls: 0, totalGasUsed: 0n, totalMockGas: 0n };
      aggregate.calls += 1;
      aggregate.totalGasUsed += BigInt(receipt.gasUsed);
      aggregate.totalMockGas += mockGas;
      aggregates.set(key, aggregate);
    } catch {
      // Skip transactions that can't be resolved
    }
  }
  if (aggregates.size === 0) return;

  const selectorNames = await buildSelectorNameMap(hre);
  const addressNames = await buildAddressNameMap(hre, [...new Set([...aggregates.values()].map((a) => a.to))]);

  // Merge per-address aggregates by resolved contract name + method, so multiple deployed
  // instances of the same contract (one per test, typically) share a row.
  const merged = new Map<string, { contract: string; method: string } & Omit<MethodAggregate, 'to' | 'selector'>>();
  for (const a of aggregates.values()) {
    const contract = addressNames.get(a.to) ?? shortAddress(a.to);
    const method = selectorNames.get(a.selector) ?? a.selector;
    const key = `${contract}:${method}`;
    const row = merged.get(key) ?? { contract, method, calls: 0, totalGasUsed: 0n, totalMockGas: 0n };
    row.calls += a.calls;
    row.totalGasUsed += a.totalGasUsed;
    row.totalMockGas += a.totalMockGas;
    merged.set(key, row);
  }

  const rows = [...merged.values()]
    .map((r) => {
      const avgGasUsed = r.totalGasUsed / BigInt(r.calls);
      const avgMockGas = r.totalMockGas / BigInt(r.calls);
      return {
        contract: r.contract,
        method: r.method,
        calls: r.calls,
        avgGasUsed,
        avgAdjusted: avgGasUsed - avgMockGas,
        overheadPct: avgGasUsed === 0n ? 0 : Number((avgMockGas * 100n) / avgGasUsed),
      };
    })
    .sort((a, b) => a.contract.localeCompare(b.contract) || a.method.localeCompare(b.method));

  const headers = ['Contract', 'Method', 'Calls', 'Avg gas (mocks)', 'Avg gas (adjusted)', 'Mock overhead'];
  const cells = rows.map((r) => [
    r.contract,
    r.method,
    String(r.calls),
    r.avgGasUsed.toLocaleString(),
    r.avgAdjusted.toLocaleString(),
    `${r.overheadPct}%`,
  ]);
  const widths = headers.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i].length)));
  const line = (row: string[]) => `│ ${row.map((cell, i) => cell.padEnd(widths[i])).join(' │ ')} │`;
  const divider = (l: string, m: string, r: string) => `${l}${widths.map((w) => '─'.repeat(w + 2)).join(m)}${r}`;

  console.log('');
  console.log(chalk.bold('[COFHE-MOCKS] Gas summary') + chalk.dim(' — adjusted ≈ cost excluding mock-only overhead'));
  console.log(divider('┌', '┬', '┐'));
  console.log(line(headers));
  console.log(divider('├', '┼', '┤'));
  for (const row of cells) console.log(line(row));
  console.log(divider('└', '┴', '┘'));
  console.log(
    chalk.dim(
      'Raw numbers include on-chain replication of off-chain CoFHE work; adjusted numbers estimate real-network cost. estimateGas remains unadjusted.'
    )
  );
};
