import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { parseAbiItem, toEventSelector, toFunctionSelector, toFunctionSignature, type PublicClient } from 'viem';
import { TASK_MANAGER_ADDRESS } from '@cofhe/sdk';
import type { ArtifactManager } from 'hardhat/types/artifacts';

/// Topic of MockCoFHE's `MockGasConsumed(uint256)` event, emitted once per block of
/// mock-only work (op replication, decrypt-task storage, log building) with the gas it
/// consumed. Summing these per transaction gives the mock overhead of that transaction.
export const MOCK_GAS_CONSUMED_EVENT = parseAbiItem('event MockGasConsumed(uint256 gas)');
export const MOCK_GAS_CONSUMED_TOPIC = toEventSelector(MOCK_GAS_CONSUMED_EVENT);

/// Minimal receipt shape - compatible with viem and ethers v6 receipts.
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
    if (
      log.address.toLowerCase() === TASK_MANAGER_ADDRESS.toLowerCase() &&
      log.topics[0]?.toLowerCase() === MOCK_GAS_CONSUMED_TOPIC
    ) {
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
//
// Hardhat 3 runs node:test files in worker subprocesses, and every network.connect()
// creates its own in-process chain - so a single query at the end of the `test` task
// (which runs in the parent process) can't see any of the transactions. Instead:
//   1. Each connection is registered here (from the plugin's newConnection hook) when
//      `cofhe.gasSummary` is enabled.
//   2. On worker `beforeExit`, the gas rows of every registered connection are collected
//      (eth_getLogs + receipts) and appended to a JSON file in the hardhat cache dir.
//   3. The parent's `test` task override merges all row files and prints one table.

const SUMMARY_DIR_NAME = 'cofhe-gas-summary';

/// Serializable per-method aggregate (bigints as strings) passed from workers to the parent.
export type MockGasSummaryRow = {
  contract: string;
  method: string;
  calls: number;
  totalGasUsed: string;
  totalMockGas: string;
};

type RegisteredConnection = {
  publicClient: PublicClient;
  artifacts: ArtifactManager;
};

const registeredConnections: RegisteredConnection[] = [];
let summaryDir: string | undefined;
let exitHookInstalled = false;
let exitHookRan = false;

const shortAddress = (address: string) => `${address.slice(0, 6)}..${address.slice(-4)}`;

/// Builds a selector -> "signature" map from every compiled artifact so summary rows can
/// show method names instead of raw selectors.
const buildSelectorNameMap = async (artifacts: ArtifactManager): Promise<Map<string, string>> => {
  const selectorNames = new Map<string, string>();
  for (const fqn of await artifacts.getAllFullyQualifiedNames()) {
    try {
      const artifact = await artifacts.readArtifact(fqn);
      for (const item of artifact.abi) {
        if (item.type !== 'function') continue;
        const selector = toFunctionSelector(item);
        if (!selectorNames.has(selector)) selectorNames.set(selector, toFunctionSignature(item));
      }
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
  publicClient: PublicClient,
  artifacts: ArtifactManager,
  addresses: `0x${string}`[]
): Promise<Map<string, string>> => {
  const codeToName = new Map<string, string>();
  for (const fqn of await artifacts.getAllFullyQualifiedNames()) {
    try {
      const artifact = await artifacts.readArtifact(fqn);
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
      const code = (await publicClient.getCode({ address })) ?? '0x';
      addressNames.set(address, codeToName.get(code.toLowerCase()) ?? shortAddress(address));
    } catch {
      addressNames.set(address, shortAddress(address));
    }
  }
  return addressNames;
};

/// Collects per-method gas aggregates from one connection's chain.
export const collectMockGasRows = async (
  publicClient: PublicClient,
  artifacts: ArtifactManager
): Promise<MockGasSummaryRow[]> => {
  let logs;
  try {
    logs = await publicClient.getLogs({
      address: TASK_MANAGER_ADDRESS,
      event: MOCK_GAS_CONSUMED_EVENT,
      fromBlock: 0n,
      toBlock: 'latest',
    });
  } catch {
    return [];
  }
  if (logs.length === 0) return [];

  // Sum mock gas per transaction
  const mockGasPerTx = new Map<`0x${string}`, bigint>();
  for (const log of logs) {
    if (log.transactionHash === null) continue;
    mockGasPerTx.set(log.transactionHash, (mockGasPerTx.get(log.transactionHash) ?? 0n) + (log.args.gas ?? 0n));
  }

  // Aggregate per called contract + method
  type Aggregate = { to: `0x${string}`; selector: string; calls: number; totalGasUsed: bigint; totalMockGas: bigint };
  const aggregates = new Map<string, Aggregate>();
  for (const [txHash, mockGas] of mockGasPerTx) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      const tx = await publicClient.getTransaction({ hash: txHash });
      if (!tx.to) continue;

      const selector = (tx.input ?? '0x').slice(0, 10);
      const key = `${tx.to}:${selector}`;
      const aggregate = aggregates.get(key) ?? { to: tx.to, selector, calls: 0, totalGasUsed: 0n, totalMockGas: 0n };
      aggregate.calls += 1;
      aggregate.totalGasUsed += receipt.gasUsed;
      aggregate.totalMockGas += mockGas;
      aggregates.set(key, aggregate);
    } catch {
      // Skip transactions that can't be resolved
    }
  }
  if (aggregates.size === 0) return [];

  const selectorNames = await buildSelectorNameMap(artifacts);
  const addressNames = await buildAddressNameMap(publicClient, artifacts, [
    ...new Set([...aggregates.values()].map((a) => a.to)),
  ]);

  return [...aggregates.values()].map((a) => ({
    contract: addressNames.get(a.to) ?? shortAddress(a.to),
    method: selectorNames.get(a.selector) ?? a.selector,
    calls: a.calls,
    totalGasUsed: a.totalGasUsed.toString(),
    totalMockGas: a.totalMockGas.toString(),
  }));
};

/// Registers a connection for end-of-run gas summary collection, installing (once) a
/// process beforeExit hook that dumps the aggregated rows into the hardhat cache dir
/// for the parent `test` task to merge and print.
export const registerGasSummaryConnection = (
  publicClient: PublicClient,
  artifacts: ArtifactManager,
  cacheDir: string
) => {
  registeredConnections.push({ publicClient, artifacts });
  summaryDir = path.join(cacheDir, SUMMARY_DIR_NAME);

  if (exitHookInstalled) return;
  exitHookInstalled = true;

  process.on('beforeExit', () => {
    if (exitHookRan) return;
    exitHookRan = true;

    // Async work here keeps the event loop alive until it settles; the guard above
    // prevents re-entry when beforeExit fires again afterwards.
    void (async () => {
      const rows: MockGasSummaryRow[] = [];
      for (const { publicClient: client, artifacts: arts } of registeredConnections) {
        try {
          rows.push(...(await collectMockGasRows(client, arts)));
        } catch {
          // A closed or unusable connection contributes nothing
        }
      }
      if (rows.length === 0 || summaryDir === undefined) return;

      try {
        fs.mkdirSync(summaryDir, { recursive: true });
        const file = path.join(summaryDir, `rows-${process.pid}-${Date.now()}.json`);
        fs.writeFileSync(file, JSON.stringify(rows), 'utf8');
      } catch {
        // Summary is best-effort; never fail the test run over it
      }
    })();
  });
};

/// Removes any leftover row files (from previous or non-test runs).
export const cleanGasSummaryDir = (cacheDir: string) => {
  try {
    fs.rmSync(path.join(cacheDir, SUMMARY_DIR_NAME), { recursive: true, force: true });
  } catch {
    // best-effort
  }
};

/// Reads all worker row files, merges them by contract + method, prints the table, and
/// cleans up. Called from the parent `test` task after the run completes.
export const printMockGasSummaryFromDir = (cacheDir: string) => {
  const dir = path.join(cacheDir, SUMMARY_DIR_NAME);
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return;
  }

  const merged = new Map<
    string,
    { contract: string; method: string; calls: number; gasUsed: bigint; mockGas: bigint }
  >();
  for (const file of files) {
    try {
      const rows: MockGasSummaryRow[] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      for (const r of rows) {
        const key = `${r.contract}:${r.method}`;
        const row = merged.get(key) ?? { contract: r.contract, method: r.method, calls: 0, gasUsed: 0n, mockGas: 0n };
        row.calls += r.calls;
        row.gasUsed += BigInt(r.totalGasUsed);
        row.mockGas += BigInt(r.totalMockGas);
        merged.set(key, row);
      }
    } catch {
      // skip unreadable files
    }
  }
  cleanGasSummaryDir(cacheDir);
  if (merged.size === 0) return;

  const rows = [...merged.values()]
    .map((r) => {
      const avgGasUsed = r.gasUsed / BigInt(r.calls);
      const avgMockGas = r.mockGas / BigInt(r.calls);
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
  const widths = headers.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i]!.length)));
  const line = (row: string[]) => `│ ${row.map((cell, i) => cell.padEnd(widths[i]!)).join(' │ ')} │`;
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
