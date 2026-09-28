import type { TaskOverrideActionFunction } from 'hardhat/types/tasks';

import { cleanGasSummaryDir, printMockGasSummaryFromDir } from '../gas.js';

/// Wraps the `test` task to print the adjusted-gas summary when `cofhe.gasSummary` is
/// enabled. Tests run in node:test worker processes, each with its own chains; workers
/// dump their per-method gas rows into the hardhat cache dir at exit (see gas.ts), and
/// this override merges and prints them once the run completes.
const action: TaskOverrideActionFunction = async (args, hre, runSuper) => {
  if (!hre.config.cofhe.gasSummary) {
    return runSuper(args);
  }

  // Drop leftovers from previous or aborted runs so the table only reflects this run.
  cleanGasSummaryDir(hre.config.paths.cache);

  const result = await runSuper(args);
  printMockGasSummaryFromDir(hre.config.paths.cache);
  return result;
};

export default action;
